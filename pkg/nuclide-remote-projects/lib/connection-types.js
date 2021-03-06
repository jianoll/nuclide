'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {SshHandshake} from '../../nuclide-remote-connection';

export type NuclideRemoteAuthMethods =
  // $FlowFixMe: Flow can't find the PASSWORD property on SupportedMethods.
  SshHandshake.SupportedMethods.PASSWORD |
  // $FlowFixMe: Flow can't find the SSL_AGENT property on SupportedMethods.
  SshHandshake.SupportedMethods.SSL_AGENT |
  // $FlowFixMe: Flow can't find the PRIVATE_KEY property on SupportedMethods.
  SshHandshake.SupportedMethods.PRIVATE_KEY;

export type NuclideRemoteConnectionParams = {
  username: string;
  server: string;
  cwd: string;
  remoteServerCommand: string;
  sshPort: string;
  pathToPrivateKey: string;
  authMethod: NuclideRemoteAuthMethods;
};

// The same as NuclideRemoteConnectionParams, minus `remoteServerCommand`.
export type NuclideNewConnectionProfileInitialFields = {
  username: string;
  server: string;
  cwd: string;
  sshPort: string;
  pathToPrivateKey: string;
  authMethod: NuclideRemoteAuthMethods;
};

export type NuclideRemoteConnectionProfile = {
  deletable: boolean;
  displayTitle: string;
  params: NuclideRemoteConnectionParams;
};

export type NuclideSavedConnectionDialogConfig = {
  config: NuclideRemoteConnectionParams;
  lastOfficialRemoteServerCommand: string;
};

// This type should not be saved -- it contains the user's password.
export type NuclideRemoteConnectionParamsWithPassword = {
  username: string;
  server: string;
  cwd: string;
  remoteServerCommand: string;
  sshPort: string;
  pathToPrivateKey: string;
  authMethod: NuclideRemoteAuthMethods;
  password: string;
};
