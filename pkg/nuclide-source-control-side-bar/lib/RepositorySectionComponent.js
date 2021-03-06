'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {BookmarkInfo} from '../../nuclide-hg-repository-base/lib/HgService';
import type {SelectableItem} from './SideBarComponent';

import classnames from 'classnames';
import invariant from 'assert';
import {React} from 'react-for-atom';

type Props = {
  bookmarks: ?Array<BookmarkInfo>;
  hasSeparator: boolean;
  onBookmarkClick: (bookmark: BookmarkInfo, repository: atom$Repository) => mixed;
  onBookmarkContextMenu:
    (bookmark: BookmarkInfo, repository: atom$Repository, event: SyntheticMouseEvent) => mixed;
  onRepoGearClick: (repository: atom$Repository, event: SyntheticMouseEvent) => mixed;
  onUncommittedChangesClick: (repository: atom$Repository) => mixed;
  repository: ?atom$Repository;
  selectedItem: ?SelectableItem;
  title: string;
};

// Returns true if the given bookmarks are not void and are deeply equal.
function bookmarkIsEqual(a: ?BookmarkInfo, b: ?BookmarkInfo) {
  return a != null
    && b != null
    && a.rev === b.rev
    && a.bookmark === b.bookmark;
}

export default class RepositorySectionComponent extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
    (this: any)._handleBookmarkContextMenu = this._handleBookmarkContextMenu.bind(this);
    (this: any)._handleRepoGearClick = this._handleRepoGearClick.bind(this);
    (this: any)._handleUncommittedChangesClick = this._handleUncommittedChangesClick.bind(this);
  }

  _handleBookmarkClick(bookmark: BookmarkInfo) {
    invariant(this.props.repository != null);
    this.props.onBookmarkClick(bookmark, this.props.repository);
  }

  _handleBookmarkContextMenu(bookmark: BookmarkInfo, event: SyntheticMouseEvent) {
    invariant(this.props.repository != null);
    this.props.onBookmarkContextMenu(bookmark, this.props.repository, event);
  }

  _handleRepoGearClick(event: SyntheticMouseEvent) {
    invariant(this.props.repository != null);
    this.props.onRepoGearClick(this.props.repository, event);
  }

  _handleUncommittedChangesClick() {
    invariant(this.props.repository != null);
    this.props.onUncommittedChangesClick(this.props.repository);
  }

  render(): React.Element {
    const repository = this.props.repository;
    const selectedItem = this.props.selectedItem;

    let bookmarksBranchesHeader;
    let bookmarksBranchesList;
    let createButton;
    if (repository != null) {
      if (repository.getType() === 'hg') {
        bookmarksBranchesHeader = 'BOOKMARKS';
        createButton = (
          <button
            className="btn btn-sm icon icon-plus"
            onClick={this._handleRepoGearClick}
            style={{marginTop: '6px', position: 'absolute', right: '10px'}}
          />
        );
      } else if (repository.getType() === 'git') {
        bookmarksBranchesHeader = 'BRANCHES';
      } else {
        bookmarksBranchesHeader = `UNSUPPORTED REPOSITORY TYPE ${repository.getType()}`;
      }

      if (repository.getType() === 'hg') {
        const repositoryBookmarks = this.props.bookmarks;
        if (repositoryBookmarks != null) {
          bookmarksBranchesList = (
            <ul className="list-group">
              {repositoryBookmarks.map(bookmark => {
                let activeCheck;
                if (bookmark.active) {
                  activeCheck = (
                    <span
                      className="icon icon-check text-success"
                      style={{marginLeft: '10px'}}
                      title="Active bookmark"
                    />
                  );
                }

                let liClassName = classnames(
                  'list-item nuclide-source-control-side-bar--list-item', {
                    // Deeply compare bookmarks because the Objects get re-created when bookmarks
                    // are re-fetched and will not remain equal across fetches.
                    selected: selectedItem != null
                      && selectedItem.type === 'bookmark'
                      && bookmarkIsEqual(bookmark, selectedItem.bookmark),
                  }
                );

                return (
                  <li
                    className={liClassName}
                    data-name={bookmark.bookmark}
                    onClick={this._handleBookmarkClick.bind(this, bookmark)}
                    onContextMenu={
                      this._handleBookmarkContextMenu.bind(this, bookmark)
                    }
                    key={bookmark.bookmark}>
                    <span className="icon icon-bookmark">
                      {bookmark.bookmark}
                      {activeCheck}
                    </span>
                  </li>
                );
              })}
            </ul>
          );
        }
      } else {
        bookmarksBranchesList = (
          <div className="nuclide-source-control-side-bar--header text-info">
            Only Mercurial repositories are supported. '{repository.getType()}' found.
          </div>
        );
      }
    }

    let separator;
    if (this.props.hasSeparator) {
      separator = <hr className="nuclide-source-control-side-bar--repo-separator" />;
    }

    const uncommittedChangesClassName = classnames(
      'list-item nuclide-source-control-side-bar--list-item',
      {
        selected: selectedItem != null && selectedItem.type === 'uncommitted',
      }
    );
    return (
      <li>
        {separator}
        <h5 className="text-highlight nuclide-source-control-side-bar--repo-header">
          {this.props.title}
        </h5>
        <ul className="list-group">
          <li
            className={uncommittedChangesClassName}
            onClick={this._handleUncommittedChangesClick}>
            <span>
              Uncommitted Changes
            </span>
          </li>
        </ul>
        {createButton}
        <h6 className="nuclide-source-control-side-bar--header">
          {bookmarksBranchesHeader}
        </h6>
        {bookmarksBranchesList}
      </li>
    );
  }

}
