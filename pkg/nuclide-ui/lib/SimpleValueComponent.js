'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

// TODO @jxg export debugger typedefs from main module. (t11406963)
import type {
  EvaluationResult,
} from '../../nuclide-debugger-atom/lib/Bridge';

import {React} from 'react-for-atom';

type SimpleValueComponentProps = {
  expression: string;
  evaluationResult: EvaluationResult;
};

function renderNullish(evaluationResult: EvaluationResult): ?string {
  const {_type} = evaluationResult;
  return (
    _type === 'undefined' || _type === 'null'
      ? _type
      : null
  );
}

function renderString(evaluationResult: EvaluationResult): ?string {
  const {
    _type,
    value,
  } = evaluationResult;
  return (
    _type === 'string'
      ? `"${value}"`
      : null
  );
}

function renderDefault(evaluationResult: EvaluationResult): ?string {
  return evaluationResult.value;
}

const valueRenderers = [
  renderString,
  renderNullish,
  renderDefault,
];

export default class SimpleValueComponent extends React.Component {
  props: SimpleValueComponentProps;

  render(): ?React.Element {
    const {
      expression,
      evaluationResult,
    } = this.props;
    let displayValue;
    for (const renderer of valueRenderers) {
      displayValue = renderer(evaluationResult);
      if (displayValue != null) {
        break;
      }
    }
    if (displayValue == null || displayValue === '') {
      displayValue = evaluationResult._description || '(N/A)';
    }
    return (
      <span>{expression}: {displayValue}</span>
    );
  }
}
