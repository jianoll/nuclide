'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Point} from 'atom';
import {Observable} from 'rxjs';
import {
  onWorkspaceDidStopChangingActivePaneItem,
  observeActivePaneItemDebounced,
  observeActiveEditorsDebounced,
  editorChangesDebounced,
  observeTextEditorsPositions,
} from '../debounced';
import {goToLocationInEditor} from '../go-to-location';

import {observableFromSubscribeFunction} from '../../commons-node/event';

// Shorter than the default so the tests don't run long.
const DEBOUNCE_INTERVAL = 10;
// Longer than DEBOUNCE_INTERVAL so when we wait for this amount of time, a debounced event will be
// emitted.
const SLEEP_INTERVAL = 15;
// Sleep interval for double the debounce interval.
const SLEEP_INTERVAL_2 = 25;

describe('pane item change events', () => {
  let pane: atom$Pane = (null: any);
  let editor1: atom$TextEditor = (null: any);
  let editor2: atom$TextEditor = (null: any);
  let editor3: atom$TextEditor = (null: any);
  let nonEditor: Object = (null: any);
  let activePaneItems: Observable<mixed> = (null: any);

  beforeEach(() => {
    waitsForPromise(async () => {
      // Since RX manages to dodge the built-in clock mocking we'll use the real clock for these
      // tests :(
      jasmine.useRealClock();

      editor3 = await atom.workspace.open();
      editor2 = await atom.workspace.open();
      editor1 = await atom.workspace.open();

      pane = atom.workspace.getActivePane();
      nonEditor = {
        // Ordinarily we would have to provide an element or register a view, but since we are just
        // testing the model here and not actually rendering anything Atom doesn't complain. If
        // these tests start failing because Atom can't find a view, look here.
        getTitle() { return 'foo'; },
      };
      pane.addItem(nonEditor);
      pane.activateItem(editor1);
    });
  });

  describe('onWorkspaceDidStopChangingActivePaneItem', () => {
    beforeEach(() => {
      // Convert to an Observable for ease of manipulation
      activePaneItems = observableFromSubscribeFunction(callback => {
        return onWorkspaceDidStopChangingActivePaneItem(callback, DEBOUNCE_INTERVAL);
      });
    });

    it('should not issue an initial item', () => {
      waitsForPromise(async () => {
        expect(
          await activePaneItems
            .first()
            // Split out an empty observable after waiting 20 ms.
            .race(Observable.empty().delay(20))
            .toArray()
            .toPromise()
        ).toEqual([]);
      });
    });

    it('should debounce', () => {
      waitsForPromise(async () => {
        const itemsPromise = activePaneItems
          .take(1)
          .toArray()
          .toPromise();

        await sleep(SLEEP_INTERVAL);

        pane.activateItem(editor2);
        pane.activateItem(editor3);

        expect(await itemsPromise).toEqual([editor3]);
      });
    });
  });

  describe('observeActivePaneItemDebounced', () => {
    beforeEach(() => {
      activePaneItems = observeActivePaneItemDebounced(DEBOUNCE_INTERVAL);
    });

    it('should issue an initial item', () => {
      waitsForPromise(async () => {
        expect(
          await activePaneItems
            .first()
            // Split out an empty observable after waiting 20 ms.
            .race(Observable.empty().delay(20))
            .toArray()
            .toPromise()
        ).toEqual([editor1]);
      });
    });

    it('should debounce', () => {
      waitsForPromise(async () => {
        const itemsPromise = activePaneItems
          .take(2)
          .toArray()
          .toPromise();

        await sleep(SLEEP_INTERVAL);

        pane.activateItem(editor2);
        pane.activateItem(editor3);

        expect(await itemsPromise).toEqual([editor1, editor3]);
      });
    });
  });

  describe('observeActiveEditorsDebounced', () => {
    let activeEditors: Observable<?atom$TextEditor> = (null: any);
    beforeEach(() => {
      activeEditors = observeActiveEditorsDebounced(DEBOUNCE_INTERVAL);
    });

    it('should return null if the item is not an editor', () => {
      waitsForPromise(async () => {
        const itemsPromise = activeEditors
          .take(3)
          .toArray()
          .toPromise();

        await sleep(SLEEP_INTERVAL);
        pane.activateItem(nonEditor);

        await sleep(SLEEP_INTERVAL);
        pane.activateItem(editor2);

        expect(await itemsPromise).toEqual([editor1, null, editor2]);
      });
    });
  });

  describe('observeTextEditorsPositions', () => {
    it('cursor moves and non-editors', () => {
      waitsForPromise(async () => {
        const itemsPromise = observeTextEditorsPositions(DEBOUNCE_INTERVAL, DEBOUNCE_INTERVAL)
          .take(5)
          .toArray()
          .toPromise();
        await sleep(SLEEP_INTERVAL_2);
        goToLocationInEditor(editor1, 3, 4);
        await sleep(SLEEP_INTERVAL_2);
        pane.activateItem(nonEditor);
        await sleep(SLEEP_INTERVAL_2);
        goToLocationInEditor(editor1, 0, 0);
        await sleep(SLEEP_INTERVAL_2);
        pane.activateItem(editor2);
        await sleep(SLEEP_INTERVAL_2);
        goToLocationInEditor(editor1, 3, 4);
        await sleep(SLEEP_INTERVAL_2);
        goToLocationInEditor(editor2, 1, 1);
        await sleep(SLEEP_INTERVAL_2);

        expect(await itemsPromise).toEqual([
          {
            editor: editor1,
            position: new Point(4, 0),
          },
          {
            editor: editor1,
            position: new Point(3, 4),
          },
          null,
          {
            editor: editor2,
            position: new Point(3, 0),
          },
          {
            editor: editor2,
            position: new Point(1, 1),
          },
        ]);
      });
    });
  });
});

describe('editorChangesDebounced', () => {
  let editor: atom$TextEditor = (null: any);
  let editorChanges: Observable<void> = (null: any);

  beforeEach(() => {
    waitsForPromise(async () => {
      jasmine.useRealClock();
      editor = await atom.workspace.open();
      editorChanges = editorChangesDebounced(editor, DEBOUNCE_INTERVAL);
    });
  });

  it('debounces changes', () => {
    waitsForPromise(async () => {
      const eventsPromise = editorChanges
        .takeUntil(
          Observable.of(null).delay(50)
        )
        .toArray()
        .toPromise();

      await sleep(SLEEP_INTERVAL);

      editor.insertNewline();
      editor.insertNewline();

      expect((await eventsPromise).length).toBe(1);
    });
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
