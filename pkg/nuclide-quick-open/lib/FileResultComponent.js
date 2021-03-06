'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FileResult} from './types';

import {React} from 'react-for-atom';
import fileTypeClass from '../../commons-atom/file-type-class';
import path from 'path';

type Key = number | string;

function renderSubsequence(seq: string, props: Object): ?React.Element {
  return seq.length === 0 ? null : <span {...props}>{seq}</span>;
}

function renderUnmatchedSubsequence(seq: string, key: Key): ?React.Element {
  return renderSubsequence(seq, {key});
}

function renderMatchedSubsequence(seq: string, key: Key): ?React.Element {
  return renderSubsequence(
    seq,
    {
      key,
      className: 'quick-open-file-search-match',
    }
  );
}

class FileResultComponent {

  static getComponentForItem(
    item: FileResult,
    serviceName: string,
    dirName: string
  ): React.Element {
    // Trim the `dirName` off the `filePath` since that's shown by the group
    let filePath = item.path;
    let matchIndexes = item.matchIndexes || [];
    if (filePath.startsWith(dirName)) {
      filePath = '.' + filePath.slice(dirName.length);
      matchIndexes = matchIndexes.map(i => i - (dirName.length - 1));
    }

    let streakOngoing = false;
    let start = 0;
    const pathComponents = [];
    // Split the path into highlighted and non-highlighted subsequences for optimal rendering perf.
    // Do this in O(n) where n is the number of matchIndexes (ie. less than the length of the path).
    matchIndexes.forEach((i, n) => {
      if (matchIndexes[n + 1] === i + 1) {
        if (!streakOngoing) {
          pathComponents.push(renderUnmatchedSubsequence(filePath.slice(start, i), i));
          start = i;
          streakOngoing = true;
        }
      } else {
        if (streakOngoing) {
          pathComponents.push(renderMatchedSubsequence(filePath.slice(start, i + 1), i));
          streakOngoing = false;
        } else {
          if (i > 0) {
            pathComponents.push(renderUnmatchedSubsequence(filePath.slice(start, i), `before${i}`));
          }
          pathComponents.push(renderMatchedSubsequence(filePath.slice(i, i + 1), i));
        }
        start = i + 1;
      }
    });
    pathComponents.push(renderUnmatchedSubsequence(filePath.slice(start, filePath.length), 'last'));

    const filenameClasses = ['file', 'icon', fileTypeClass(filePath)].join(' ');
    // `data-name` is support for the "file-icons" package.
    // See: https://atom.io/packages/file-icons
    return (
      <div className={filenameClasses} data-name={path.basename(filePath)}>
        {pathComponents}
      </div>
    );
  }
}

module.exports = FileResultComponent;
