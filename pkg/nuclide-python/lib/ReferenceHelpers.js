'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FindReferencesReturn} from '../../nuclide-find-references';

import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import loadingNotification from '../../commons-atom/loading-notification';
import remoteUri from '../../nuclide-remote-uri';
import path from 'path';

export default class ReferenceHelpers {

  @trackTiming('python.get-references')
  static async getReferences(
    editor: TextEditor,
    position: atom$Point
  ): Promise<?FindReferencesReturn> {
    const src = editor.getPath();
    if (!src) {
      return null;
    }

    // Get paths that are parents of src path, in descending order of path length.
    const projectPaths = atom.project.getPaths()
      .filter(p => remoteUri.contains(p, src))
      .sort((a, b) => b.length - a.length);

    // Choose the best matching project root (longest path) as the baseUri, or if
    // no project exists, use the dirname of the src file.
    const baseUri = projectPaths[0] || path.dirname(src);

    const contents = editor.getText();
    const line = position.row;
    const column = position.column;

    const service = await getServiceByNuclideUri('JediService', src);
    if (!service) {
      return null;
    }

    const result = await loadingNotification(
      service.getReferences(
        src,
        contents,
        line,
        column,
      ),
      'Loading references from Jedi server...',
    );

    if (!result || result.references.length === 0) {
      return {type: 'error', message: 'No usages were found.'};
    }

    const symbolName = result.references[0].text;

    // Process this into the format nuclide-find-references expects.
    const references = result.references.map(ref => {
      return {
        uri: ref.file,
        name: null,
        start: {
          line: ref.line + 1,
          column: ref.column + 1,
        },
        end: {
          line: ref.line + 1,
          column: ref.column + ref.text.length,
        },
      };
    });

    return {
      type: 'data',
      baseUri,
      referencedSymbolName: symbolName,
      references,
    };
  }

}
