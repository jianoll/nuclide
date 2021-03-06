'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {HackSearchResult} from './types';
import type {NuclideUri} from '../../nuclide-remote-uri';
import type {LogLevel} from '../../nuclide-logging/lib/rpc-types';

import fsPromise from '../../commons-node/fsPromise';
import {retryLimit} from '../../commons-node/promise';
import {SymbolType} from '../../nuclide-hack-common';
import {
  callHHClient,
  getSearchResults,
} from './HackHelpers';
import {setHackCommand, setUseIde, getHackExecOptions} from './hack-config';
import path from 'path';
import {getPath} from '../../nuclide-remote-uri';
import {logger} from './hack-config';

export type SymbolTypeValue = 0 | 1 | 2 | 3 | 4;

export type HackDiagnosticsResult = {
  // The location of the .hhconfig where these messages came from.
  hackRoot: NuclideUri;
  messages: Array<{
    message: HackDiagnostic;
  }>;
};

/**
 * Each error or warning can consist of any number of different messages from
 * Flow to help explain the problem and point to different locations that may be
 * of interest.
 */
export type HackDiagnostic = Array<SingleHackMessage>;

export type SingleHackMessage = {
  path: ?NuclideUri;
  descr: string;
  code: number;
  line: number;
  start: number;
  end: number;
};

export type HackFunctionDetails = {
  params: Array<{name: string}>;
};

// Note that all line/column values are 1-based.
export type HackRange = {
  filename: NuclideUri;
  line: number;
  char_start: number;
  char_end: number;
};

// Note that all line/column values are 1-based.
export type HackSpan = {
  filename: NuclideUri;
  line_start: number;
  char_start: number;
  line_end: number;
  char_end: number;
};

export type HackCompletion = {
  name: string;
  type: string;
  pos: HackRange;
  func_details: ?HackFunctionDetails;
};

export type HackCompletionsResult = {
  hackRoot: NuclideUri;
  completions: Array<HackCompletion>;
};

export type HackDefinitionResult = {
  hackRoot: NuclideUri;
  definitions: Array<HackSearchPosition>;
};

export type HackReferencesResult = {
  hackRoot: NuclideUri;
  references: Array<HackReference>;
};

export type HackSearchPosition = {
  path: NuclideUri;
  line: number;
  column: number;
  name: string;
  length: number;
  scope: string;
  additionalInfo: string;
};

export type HackReference = {
  name: string;
  filename: NuclideUri;
  line: number;
  char_start: number;
  char_end: number;
};

export type HackTypedRegion = {
  color: 'default' | 'checked' | 'partial' | 'unchecked';
  text: string;
};

export type HackIdeOutlineItem = {
  kind: 'function' | 'class' | 'property' | 'method' | 'const'
    | 'enum' | 'typeconst' | 'param' | 'trait' | 'interface';
  name: string;
  position: HackRange;
  span: HackSpan;
  modifiers: ?Array<string>;
  children?: Array<HackIdeOutlineItem>;
  params?: Array<HackIdeOutlineItem>;
  docblock?: string;
};

export type HackIdeOutline = Array<HackIdeOutlineItem>;

export type HackTypeAtPosResult = {
  type: ?string;
  pos: ?HackRange;
};

export type HackFindLvarRefsResult = {
  positions: Array<HackRange>;
  internal_error: boolean;
};

export type HackFormatSourceResult = {
  error_message: string;
  result: string;
  internal_error: boolean;
};

export type HackGetMethodNameResult = {
  name: string;
  result_type: 'class' | 'method' | 'function' | 'local';
  pos: HackRange;
};

export type HackDefinition = {
  definition_pos: ?HackRange;
  name: string;
  pos: HackRange;
};

const HH_DIAGNOSTICS_DELAY_MS = 600;
const HH_CLIENT_MAX_TRIES = 10;

export async function getDiagnostics(
  file: NuclideUri,
  currentContents?: string
): Promise<?HackDiagnosticsResult> {
  const hhResult = await retryLimit(
    () => callHHClient(
      /*args*/ [],
      /*errorStream*/ true,
      /*outputJson*/ true,
      /*processInput*/ null,
      /*file*/ file,
    ),
    result => result != null,
    HH_CLIENT_MAX_TRIES,
    HH_DIAGNOSTICS_DELAY_MS,
  );
  if (!hhResult) {
    return null;
  }
  const {hackRoot, result} = hhResult;
  const messages = (
    (result: any): {errors: Array<{message: HackDiagnostic}>}
  ).errors;

  // Use a consistent null 'falsy' value for the empty string, undefined, etc.
  messages.forEach(error => {
    error.message.forEach(component => {
      component.path = component.path || null;
    });
  });

  return {
    hackRoot,
    messages,
  };
}

export async function getCompletions(
  file: NuclideUri,
  markedContents: string
): Promise<?HackCompletionsResult> {
  const hhResult = await callHHClient(
    /*args*/ ['--auto-complete'],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ markedContents,
    /*file*/ file,
  );
  if (!hhResult) {
    return null;
  }
  const {hackRoot, result} = hhResult;
  const completions = ((result : any): Array<HackCompletion>);
  return {
    hackRoot,
    completions,
  };
}

export async function getIdentifierDefinition(
  file: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?HackDefinitionResult> {
  const hhResult = await callHHClient(
    // The `indetify-function` result is text, but passing --json option
    // will eliminate any hh status messages that's irrelevant.
    /*args*/ ['--json', '--identify-function', formatLineColumn(line, column)],
    /*errorStream*/ false,
    /*outputJson*/ false,
    /*processInput*/ contents,
    /*cwd*/ file,
  );
  if (!hhResult) {
    return null;
  }
  const identifier = (hhResult.result || '').trim();
  if (!identifier) {
    return null;
  }
  const searchResponse = await getSearchResults(file, identifier);
  return selectDefinitionSearchResults(searchResponse, identifier);
}

export async function getDefinition(
  file: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<Array<HackDefinition>> {
  const hhResult: any = await callHHClient(
    /*args*/ ['--ide-get-definition', formatLineColumn(line, column)],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ contents,
    /*cwd*/ file,
  );
  if (hhResult == null) {
    return [];
  }

  // Results in the current file, have filename set to empty string.
  const result = hhResult.result;
  if (result == null) {
    return [];
  }

  function fixupDefinition(definition: HackDefinition): void {
    if (definition.definition_pos != null && definition.definition_pos.filename === '') {
      definition.definition_pos.filename = file;
    }
    if (definition.pos.filename === '') {
      definition.pos.filename = file;
    }
  }
  if (Array.isArray(result)) {
    result.forEach(fixupDefinition);
    return result;
  } else {
    fixupDefinition(result);
    return [result];
  }
}

export async function getReferences(
  filePath: NuclideUri,
  symbolName: string,
  symbolType?: SymbolTypeValue,
): Promise<?HackReferencesResult> {
  let cmd = '--find-refs';
  if (symbolType === SymbolType.CLASS) {
    cmd = '--find-class-refs';
  }
  const hhResult = await callHHClient(
    /*args*/ [cmd, symbolName],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ null,
    /*file*/ filePath,
  );
  if (!hhResult) {
    return null;
  }
  const {hackRoot, result} = hhResult;
  const references = ((result: any): Array<HackReference>);
  return {
    hackRoot,
    references,
  };
}

export function getHackEnvironmentDetails(
  localFile: NuclideUri,
  hackCommand: string,
  useIdeConnection: boolean,
  logLevel: LogLevel,
): Promise<?{hackRoot: NuclideUri; hackCommand: string}> {
  setHackCommand(hackCommand);
  setUseIde(useIdeConnection);
  logger.setLogLevel(logLevel);
  return getHackExecOptions(localFile);
}

function selectDefinitionSearchResults(
  searchReposnse: ?HackSearchResult,
  query: string,
): ?HackDefinitionResult {
  if (!searchReposnse) {
    return null;
  }
  const {result: searchResults, hackRoot} = searchReposnse;
  const matchingResults = searchResults.filter(result => {
    // If the request had a :: in it, it's a full name, so we should compare to
    // the name of the result in that format.
    let fullName = result.name;
    if (query.indexOf('::') !== -1 && result.scope) {
      fullName = result.scope + '::' + fullName;
    }
    return fullName === query;
  });
  return {
    hackRoot,
    definitions: matchingResults,
  };
}

/**
 * Performs a Hack symbol search in the specified directory.
 */
export async function queryHack(
  rootDirectory: NuclideUri,
  queryString: string
): Promise<Array<HackSearchPosition>> {
  let searchPostfix;
  switch (queryString[0]) {
    case '@':
      searchPostfix = '-function';
      queryString = queryString.substring(1);
      break;
    case '#':
      searchPostfix = '-class';
      queryString = queryString.substring(1);
      break;
    case '%':
      searchPostfix = '-constant';
      queryString = queryString.substring(1);
      break;
  }
  const searchResponse = await getSearchResults(
    rootDirectory,
    queryString,
    /* filterTypes */ null,
    searchPostfix);
  if (searchResponse == null) {
    return [];
  } else {
    return searchResponse.result;
  }
}

export async function getTypedRegions(filePath: NuclideUri):
    Promise<?Array<HackTypedRegion>> {
  const hhResult = await callHHClient(
    /*args*/ ['--colour', filePath],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ null,
    /*file*/ filePath,
  );
  if (!hhResult) {
    return null;
  }
  const {result} = hhResult;
  return (result: any);
}

export async function getIdeOutline(
  filePath: NuclideUri,
  contents: string
): Promise<?HackIdeOutline> {
  const hhResult = await callHHClient(
    /*args*/ ['--ide-outline'],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ contents,
    filePath,
  );
  if (hhResult == null) {
    return null;
  }
  return (hhResult.result: any);
}

export async function getTypeAtPos(
  filePath: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?HackTypeAtPosResult> {
  const hhResult = await callHHClient(
    /*args*/ ['--type-at-pos', formatLineColumn(line, column)],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ contents,
    /*file*/ filePath,
  );
  if (!hhResult) {
    return null;
  }
  const {result} = hhResult;
  return (result: any);
}

export async function getSourceHighlights(
  filePath: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?HackFindLvarRefsResult> {
  const hhResult = await callHHClient(
    /*args*/ ['--find-lvar-refs', formatLineColumn(line, column)],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ contents,
    /*file*/ filePath,
  );
  if (!hhResult) {
    return null;
  }
  const {result} = hhResult;
  return (result: any);
}

export async function formatSource(
  filePath: NuclideUri,
  contents: string,
  startOffset: number,
  endOffset: number,
): Promise<?HackFormatSourceResult> {
  const hhResult = await callHHClient(
    /*args*/ ['--format', startOffset, endOffset],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ contents,
    /*file*/ filePath,
  );
  if (!hhResult) {
    return null;
  }
  const {result} = hhResult;
  return (result: any);
}


export async function getMethodName(
  filePath: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?HackGetMethodNameResult> {
  const hhResult = await callHHClient(
    /*args*/ ['--get-method-name', formatLineColumn(line, column)],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ contents,
    /*file*/ filePath,
  );
  if (!hhResult) {
    return null;
  }
  const {result} = hhResult;
  const name = (result: any).name;
  if (name == null || name === '') {
    return null;
  }
  return (result: any);
}

/**
 * @return whether this service can perform Hack symbol queries on the
 *   specified directory. Not all directories on a host correspond to
 *   repositories that contain Hack code.
 */
export async function isAvailableForDirectoryHack(rootDirectory: NuclideUri): Promise<boolean> {
  const hackOptions = await getHackExecOptions(rootDirectory);
  return hackOptions != null;
}

/**
 * @param fileUri a file path.  It cannot be a directory.
 * @return whether the file represented by fileUri is inside of a Hack project.
 */
export async function isFileInHackProject(fileUri: NuclideUri): Promise<boolean> {
  const filePath = getPath(fileUri);
  const hhconfigPath = await fsPromise.findNearestFile('.hhconfig', path.dirname(filePath));
  return hhconfigPath != null;
}

function formatLineColumn(line: number, column: number): string {
  return `${line}:${column}`;
}
