'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {WatchExpressionStore} from './WatchExpressionStore';
import type {
  EvaluationResult,
} from './Bridge';

import {React} from 'react-for-atom';
import {LazyNestedValueComponent} from '../../nuclide-ui/lib/LazyNestedValueComponent';
import SimpleValueComponent from '../../nuclide-ui/lib/SimpleValueComponent';

type DebuggerDatatipComponentProps = {
  expression: string;
  evaluationResult: EvaluationResult;
  watchExpressionStore: WatchExpressionStore;
};

export class DebuggerDatatipComponent extends React.Component {
  props: DebuggerDatatipComponentProps;

  render(): ?React.Element {
    const {
      expression,
      evaluationResult,
      watchExpressionStore,
    } = this.props;
    const fetchChildren = watchExpressionStore.getProperties.bind(watchExpressionStore);
    return (
      <div className="nuclide-debugger-datatip">
        <span className="nuclide-debugger-datatip-value">
          <LazyNestedValueComponent
            evaluationResult={evaluationResult}
            expression={expression}
            fetchChildren={fetchChildren}
            simpleValueComponent={SimpleValueComponent}
          />
        </span>
      </div>
    );
  }
}
