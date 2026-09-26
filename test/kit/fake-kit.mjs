/**
 * The fake kit — a stand-in for `api\Invoke-KitApi.ps1` that speaks the pinned contract exactly (API.md v1).
 *
 * Why this exists: the harness must be finished and tested somewhere that is not the cabinet. With this file the
 * whole flow — catalog, dry run, approvals, apply, verification, exit codes, `-Anonymize` — is testable on any
 * machine, offline, in CI. It is a *fixture*, not a re-implementation of the kit: it has no engine and no state
 * beyond what a test needs to see.
 *
 * Everything in it is synthetic on purpose: the "personal" values below are the fake ones the anonymization test
 * looks for (`Friedhelm`, `GAMEMASTER-PC`, `example.test`). No real machine is described here.
 */

export const API_VERSION = '1.1';

/**
 * The kit's own version, reported since ApiVersion 1.1 in every result (`KitVersion`).
 * The fake says what the contract snapshot in contract/ was taken from, so a test can see the same number a real
 * cabinet of that kit version would report.
 */
export const KIT_VERSION = '0.3.1';

/** The synthetic "person" behind the fake cabinet. Used only to prove `-Anonymize` works. */
export const FAKE_PERSON = {
  user: 'Friedhelm',
  profile: 'C:\\Users\\Friedhelm',
  computer: 'GAMEMASTER-PC',
  sid: 'S-1-5-21-1234567890-1234567890-1234567890-1001',
  ip: '192.168.47.11',
  email: 'friedhelm@example.test',
};

const REPLACEMENTS = [
  [FAKE_PERSON.profile, '<USERPROFILE>'],
  [FAKE_PERSON.user, '<USER>'],
  [FAKE_PERSON.computer, '<COMPUTER>'],
  [FAKE_PERSON.sid, '<SID>'],
  [FAKE_PERSON.ip, '<IP>'],
  [FAKE_PERSON.email, '<EMAIL>'],
];

/** A synthetic cabinet root, in the style the kit's own allowlist permits (C:\RetroBat, D:\Pinball). */
export const SYNTH_RETROBAT = 'C:\\RetroBat';

/** Refused as parameter names in any spelling; the set holds lower-cased names, see `parameterProblems`. */
const DENIED_PARAMETERS = new Set([
  'statepath', 'culture', 'kitusersid', 'trustedowner', 'taskprefix', 'automationdir', 'layerskey',
  'registryroots', 'appcompatroots', 'answerfile', 'whatif', 'confirm',
  // Since ApiVersion 1.1: the names of the API's own switches are never step parameters.
  'apply', 'approved',
]);

const INTERACTIVE_STEPS = new Set(['step.pinball.08-screens', 'step.lightgun.09-verify']);

/** The steps the fake cabinet knows, in the shape the real catalog reports. */
const STEPS = [
  { name: 'step.lightgun.01-detect', suite: 'lightgun', description: 'Lightgun step 1: detect RetroBat (emulationstation\\emulationstation.exe).', parameters: [{ Name: 'RetroBatRoot', Type: 'String', Mandatory: true }] },
  { name: 'step.lightgun.03-vigembus', suite: 'lightgun', description: 'Lightgun step 3: ViGEmBus (virtual Xbox 360 pads). Detected, and installed on request.', parameters: [{ Name: 'AllowInstall', Type: 'switch', Mandatory: false }] },
  { name: 'step.lightgun.07-retrobatsettings', suite: 'lightgun', description: 'Lightgun step 7: RetroBat settings.', parameters: [{ Name: 'RetroBatRoot', Type: 'String', Mandatory: false }] },
  { name: 'step.lightgun.10-teknoparrot', suite: 'lightgun', description: 'Lightgun step 10: TeknoParrot profiles.', parameters: [{ Name: 'RetroBatRoot', Type: 'String', Mandatory: false }, { Name: 'Exclude', Type: 'String[]', Mandatory: false }] },
  { name: 'step.pinball.01-detect', suite: 'pinball', description: 'Pinball step 1: detect the build.', parameters: [{ Name: 'Source', Type: 'String', Mandatory: true }] },
  { name: 'step.pinball.05-relocate', suite: 'pinball', description: 'Pinball step 5: rewrite the build paths from the old root to the new root.', parameters: [{ Name: 'Mode', Type: 'String', Mandatory: false }, { Name: 'NewRoot', Type: 'String', Mandatory: false }, { Name: 'OldRoot', Type: 'String', Mandatory: false }, { Name: 'OldUserHive', Type: 'String', Mandatory: false }, { Name: 'RegistryBackup', Type: 'String', Mandatory: false }] },
  { name: 'step.pinball.08-screens', suite: 'pinball', description: 'Pinball step 8: screens. Needs a person in front of the monitors.', parameters: [{ Name: 'Root', Type: 'String', Mandatory: false }, { Name: 'Mode', Type: 'String', Mandatory: false }, { Name: 'BackupDir', Type: 'String', Mandatory: false }] },
  { name: 'step.lightgun.09-verify', suite: 'lightgun', description: 'Lightgun step 9: measured checks. Pull the trigger when asked.', parameters: [{ Name: 'RetroBatRoot', Type: 'String', Mandatory: false }, { Name: 'XInputTimeoutSeconds', Type: 'Int32', Mandatory: false }, { Name: 'Again', Type: 'switch', Mandatory: false }, { Name: 'ProfileLog', Type: 'String', Mandatory: false }] },
];

/** Everything the fake catalog offers. Same fixed operations as API.md, plus the steps above. */
export function catalog() {
  const fixed = [
    { Name: 'operations', Kind: 'Read', Suite: '', Interactive: false, Available: true, Description: 'This catalog.', Parameters: [] },
    { Name: 'status', Kind: 'Read', Suite: '', Interactive: false, Available: true, Description: 'Health check of system, pinball, lightgun and security (doctor).', Parameters: [] },
    { Name: 'components', Kind: 'Read', Suite: '', Interactive: false, Available: true, Description: 'Detected components: Windows, RetroBat, Gunmote, ViGEmBus, DolphinBar, Steam, pinball build.', Parameters: [] },
    { Name: 'backups.list', Kind: 'Read', Suite: '', Interactive: false, Available: true, Description: "The kit's backups, newest first.", Parameters: [{ Name: 'Root', Type: 'String[]', Mandatory: false }] },
    { Name: 'backup.check', Kind: 'Read', Suite: '', Interactive: false, Available: true, Description: 'Checks a backup against its checksums (zip) or its original (file copy).', Parameters: [{ Name: 'Path', Type: 'String', Mandatory: true }] },
    { Name: 'backup.restore', Kind: 'Change', Suite: '', Interactive: false, Available: true, Description: 'Restores a backup; the current file is saved first. Zip backups need AllowedRoot.', Parameters: [{ Name: 'Path', Type: 'String', Mandatory: true }, { Name: 'AllowedRoot', Type: 'String[]', Mandatory: false }] },
    { Name: 'backup.remove', Kind: 'Change', Suite: '', Interactive: false, Available: true, Description: 'Deletes one backup of the kit (nothing else can be deleted).', Parameters: [{ Name: 'Path', Type: 'String', Mandatory: true }] },
    { Name: 'backup.export', Kind: 'Change', Suite: '', Interactive: false, Available: true, Description: "Copies a backup to a folder and records its SHA-256.", Parameters: [{ Name: 'Path', Type: 'String', Mandatory: true }, { Name: 'Destination', Type: 'String', Mandatory: true }] },
    { Name: 'support.bundle', Kind: 'Change', Suite: '', Interactive: false, Available: true, Description: 'Writes an anonymized support bundle (doctor, environment, step states, logs).', Parameters: [{ Name: 'Destination', Type: 'String', Mandatory: false }] },
  ];
  const steps = STEPS.map((step) => ({
    Name: step.name,
    Kind: 'Change',
    Suite: step.suite,
    Interactive: INTERACTIVE_STEPS.has(step.name),
    Available: !INTERACTIVE_STEPS.has(step.name),
    Description: step.description,
    Parameters: step.parameters,
  }));
  // Kit 0.3.0: the migration engine is there, so both are available with the plain parameters of their command.
  const optional = (name, type = 'String') => ({ Name: name, Type: type, Mandatory: false });
  const profile = [
    {
      Name: 'profile.export', Kind: 'Change', Suite: '', Interactive: false, Available: true, Description: 'Cabinet migration (Export-KitCabinetProfile).',
      Parameters: [
        { Name: 'Suite', Type: 'String', Mandatory: true }, { Name: 'Destination', Type: 'String', Mandatory: true },
        optional('PupDatabasePath'), optional('RetroBatRoot'), optional('GunmoteDir'), optional('SteamDir'),
        optional('UserName'), optional('ComputerName'), optional('UserProfile'),
      ],
    },
    {
      Name: 'profile.import', Kind: 'Change', Suite: '', Interactive: false, Available: true, Description: 'Cabinet migration (Import-KitCabinetProfile).',
      Parameters: [
        { Name: 'Path', Type: 'String', Mandatory: true },
        optional('PupDatabasePath'), optional('RetroBatRoot'), optional('GunmoteDir'), optional('SteamDir'), optional('AutoInstall', 'switch'),
      ],
    },
  ];
  return [...fixed, ...steps, ...profile].sort((a, b) => (a.Name < b.Name ? -1 : 1));
}

export function defaultState() {
  return {
    /** The one thing the cabinet is actually broken at: ViGEmBus is missing until it is installed with approval. */
    vigemInstalled: false,
    retroBatRoot: null,
    appliedSteps: [],
    restoredBackup: null,
    removedBackups: [],
    exportedProfiles: [],
    importedProfiles: [],
    bundle: null,
  };
}

/**
 * The one-shot handler: a request in, one result out, plus the exit code the real script would use.
 *
 * @param {{operation?: string, parameters?: Record<string, unknown>, apply?: boolean, approved?: boolean, anonymize?: boolean, culture?: string}} request
 * @param {{state?: object}} [context]
 */
export function handle(request, context = {}) {
  const state = context.state ?? defaultState();
  const operation = String(request.list ? 'operations' : (request.operation ?? ''));
  const parameters = request.parameters ?? {};
  const apply = Boolean(request.apply);
  const approved = Boolean(request.approved);
  const anonymize = Boolean(request.anonymize);
  const startedAt = new Date().toISOString();

  const problems = parameterProblems(operation, parameters);
  if (problems) return finish(refused(operation, problems, startedAt), anonymize);

  const spec = catalog().find((entry) => entry.Name === operation);
  if (!spec) return finish(result({ operation, status: 'NotAvailable', message: `Unknown operation: ${operation}`, startedAt }), anonymize);
  if (!spec.Available) {
    const message = spec.Interactive
      ? `${operation} needs a person at the cabinet; run it in the wizard.`
      : `Not available yet: ${operation}`;
    return finish(result({ operation, kind: spec.Kind, status: 'NotAvailable', message, startedAt }), anonymize);
  }

  switch (operation) {
    case 'operations':
      return finish(result({ operation, status: 'Ok', data: { Operations: catalog() }, startedAt }), anonymize);

    case 'status': {
      const checks = [
        { Area: 'system', Name: 'Windows', Level: 'OK', Detail: '10.0.19045' },
        { Area: 'pinball', Name: 'PinballBuild', Level: 'OK', Detail: 'D:\\Pinball' },
        { Area: 'lightgun', Name: 'RetroBat', Level: state.retroBatRoot ? 'OK' : 'INFO', Detail: state.retroBatRoot ?? 'C:\\RetroBat' },
        { Area: 'lightgun', Name: 'ViGEmBus', Level: state.vigemInstalled ? 'OK' : 'ERROR', Detail: state.vigemInstalled ? '2.4.0 installed and running' : 'not installed: no virtual Xbox 360 pad, Gunmote cannot emulate a controller' },
        { Area: 'lightgun', Name: 'DolphinBar', Level: 'WARN', Detail: `running on ${FAKE_PERSON.computer} as ${FAKE_PERSON.user} at ${FAKE_PERSON.ip}` },
        { Area: 'security', Name: 'Autologon', Level: 'OK', Detail: 'off' },
      ];
      const count = (level) => checks.filter((c) => c.Level === level).length;
      const summary = { Ok: count('OK'), Info: count('INFO'), Warn: count('WARN'), Error: count('ERROR'), Level: count('ERROR') ? 'Error' : count('WARN') ? 'Warn' : 'Ok' };
      return finish(
        result({
          operation,
          status: 'Ok',
          message: `doctor: ${summary.Error} error(s), ${summary.Warn} warning(s), ${summary.Ok} ok`,
          data: { Summary: summary, Checks: checks },
          startedAt,
        }),
        anonymize,
      );
    }

    case 'components': {
      const components = [
        { Name: 'Windows', Present: true, Version: '10.0.19045', Path: '', Detail: '' },
        { Name: 'RetroBat', Present: true, Version: '11.0', Path: 'C:\\RetroBat', Detail: '' },
        { Name: 'Gunmote', Present: true, Version: '1.6', Path: 'C:\\RetroBat\\Core\\Gunmote', Detail: '' },
        { Name: 'ViGEmBus', Present: state.vigemInstalled, Version: state.vigemInstalled ? '2.4.0' : '', Path: '', Detail: state.vigemInstalled ? '' : 'service not found' },
        { Name: 'DolphinBar', Present: true, Version: '2.5.2', Path: `${FAKE_PERSON.profile}\\Apps\\DolphinBar`, Detail: `owner ${FAKE_PERSON.email}` },
        { Name: 'Steam', Present: false, Version: '', Path: '', Detail: '' },
        { Name: 'PinballBuild', Present: true, Version: '', Path: 'D:\\Pinball', Detail: '' },
      ];
      return finish(result({ operation, status: 'Ok', data: { Components: components }, startedAt }), anonymize);
    }

    case 'backups.list': {
      const all = [
        { Kind: 'zip', Path: 'D:\\Pinball\\backups\\kit_20260101-100000-000.zip', Created: '2026-01-01T10:00:00.000Z', Purpose: 'wizard step 9', Original: '', Files: 42, Registry: 6, SizeBytes: 1234567 },
        { Kind: 'file', Path: 'C:\\RetroBat\\emulationstation\\es.cfg.bak_lightgun_20260102-110000-000', Created: '2026-01-02T11:00:00.000Z', Purpose: 'settings', Original: 'C:\\RetroBat\\emulationstation\\es.cfg', Files: 0, Registry: 0, SizeBytes: 2048 },
      ];
      const backups = all.filter((backup) => !(state.removedBackups ?? []).includes(backup.Path));
      return finish(result({ operation, status: 'Ok', data: { Backups: backups, Roots: ['D:\\Pinball\\backups', 'C:\\RetroBat'] }, startedAt }), anonymize);
    }

    case 'backup.check': {
      const ok = String(parameters.Path ?? '').includes('.bak_') || String(parameters.Path ?? '').endsWith('.zip');
      return finish(
        result({
          operation,
          status: ok ? 'Ok' : 'Failed',
          message: ok ? 'backup is intact' : 'checksums do not match',
          errors: ok ? [] : ['SHA-256 mismatch in manifest'],
          data: { Ok: ok, Differs: false, Problems: ok ? [] : ['manifest'] },
          startedAt,
        }),
        anonymize,
      );
    }

    case 'backup.restore': {
      const path = String(parameters.Path ?? '');
      if (!apply) {
        return finish(
          result({
            operation,
            kind: 'Change',
            status: 'WhatIf',
            message: `would restore ${path} and save the current file first`,
            data: { Steps: [{ Name: 'restore', Status: 'WhatIf', WhatIf: true, Message: 'plan only', Duration: 0 }] },
            startedAt,
          }),
          anonymize,
        );
      }
      state.restoredBackup = path;
      return finish(
        result({
          operation,
          kind: 'Change',
          status: 'Done',
          applied: true,
          message: `restored ${path}`,
          changes: [{ Kind: 'File', Target: 'C:\\RetroBat\\emulationstation\\es.cfg', Detail: 'restored from backup' }],
          backups: ['C:\\RetroBat\\emulationstation\\es.cfg.bak_before_restore'],
          startedAt,
        }),
        anonymize,
      );
    }

    case 'backup.remove': {
      // Same recognition as the kit (a kit zip or a <file>.bak_* copy), and in the dry run too: no plan for a path
      // that is not a kit backup, so nothing else can ever be deleted through this operation.
      const path = String(parameters.Path ?? '');
      if (!isKitBackup(path) || (state.removedBackups ?? []).includes(path)) {
        const message = `not a backup of the kit: ${path}`;
        return finish(result({ operation, kind: 'Change', status: 'Failed', message, errors: [message], startedAt }), anonymize);
      }
      if (!apply) return finish(result({ operation, kind: 'Change', status: 'WhatIf', message: `would delete the backup ${path}`, startedAt }), anonymize);
      state.removedBackups = [...(state.removedBackups ?? []), path];
      return finish(
        result({
          operation, kind: 'Change', status: 'Done', applied: true, message: `deleted ${path}`,
          changes: [{ Kind: 'File', Target: path, Detail: 'backup deleted' }], data: { Removed: path }, startedAt,
        }),
        anonymize,
      );
    }

    case 'profile.export':
      return profileExport({ parameters, state, apply, startedAt, anonymize });

    case 'profile.import':
      return profileImport({ parameters, state, apply, approved, startedAt, anonymize });

    case 'backup.export':
      if (!apply) {
        return finish(result({ operation, kind: 'Change', status: 'WhatIf', message: `would export ${parameters.Path} to ${parameters.Destination}`, startedAt }), anonymize);
      }
      return finish(
        result({
          operation, kind: 'Change', status: 'Done', applied: true, message: 'exported',
          changes: [{ Kind: 'File', Target: `${parameters.Destination}\\exported.zip`, Detail: 'export' }],
          data: { Exported: `${parameters.Destination}\\exported.zip` }, startedAt,
        }),
        anonymize,
      );

    case 'support.bundle': {
      const destination = String(parameters.Destination ?? 'C:\\RetroBat\\logs\\support-bundle.zip');
      if (!apply) return finish(result({ operation, kind: 'Change', status: 'WhatIf', message: `would write ${destination}`, startedAt }), anonymize);
      state.bundle = destination;
      return finish(
        result({
          operation, kind: 'Change', status: 'Done', applied: true, message: `wrote ${destination}`,
          changes: [{ Kind: 'File', Target: destination, Detail: 'support bundle' }], data: { Path: destination }, startedAt,
        }),
        anonymize,
      );
    }

    default:
      break;
  }

  if (operation.startsWith('step.')) return stepOperation(operation, { state, apply, approved, startedAt, anonymize, parameters });
  return finish(result({ operation, status: 'NotAvailable', message: `no handler for ${operation}`, startedAt }), anonymize);
}

function isKitBackup(path) {
  return /\.bak_[^\\/]+$/.test(path) || /\\kit_[^\\/]+\.zip$/i.test(path);
}

const VIGEM_APPROVAL =
  'Install ViGEmBus 2.4.0 (publisher Nefarius Software, SHA-256 3f2a…c91d, valid signature). This writes to the system and starts a service.';

/**
 * profile.export (kit 0.3.0): Export-KitCabinetProfile has no -WhatIf of its own, so the API does not run it at all
 * without -Apply — the dry run is the call itself, returned in Data.Parameters.
 */
function profileExport({ parameters, state, apply, startedAt, anonymize }) {
  const operation = 'profile.export';
  const suite = String(parameters.Suite ?? '');
  if (!['Pinball', 'Lightgun'].includes(suite)) {
    const message = `Cannot validate argument on parameter 'Suite': "${suite}" is not Pinball or Lightgun.`;
    return finish(result({ operation, kind: 'Change', status: 'Failed', message, errors: [message], startedAt }), anonymize);
  }
  if (!apply) {
    return finish(
      result({ operation, kind: 'Change', status: 'WhatIf', message: 'would call Export-KitCabinetProfile with these parameters', data: { Parameters: parameters }, startedAt }),
      anonymize,
    );
  }
  const path = `${String(parameters.Destination)}\\cabinet-profile-${suite.toLowerCase()}_20260926.zip`;
  state.exportedProfiles = [...(state.exportedProfiles ?? []), path];
  return finish(
    result({ operation, kind: 'Change', status: 'Done', applied: true, message: `cabinet profile written: ${path}`, data: { Result: [{ Path: path }] }, startedAt }),
    anonymize,
  );
}

/**
 * profile.import (kit 0.3.0): Import-KitCabinetProfile supports -WhatIf and takes -Approve, so the dry run returns its
 * rows (Name, Status, Detail). A row that needs a person or failed makes the operation not succeed and lands in
 * Warnings / Errors. A missing driver is only installed with AutoInstall, and only after a person approved it.
 */
function profileImport({ parameters, state, apply, approved, startedAt, anonymize }) {
  const operation = 'profile.import';
  const path = String(parameters.Path ?? '');
  const autoInstall = parameters.AutoInstall === true;
  const approvals = [];
  const rows = [];
  if (!/\.zip$/i.test(path)) {
    rows.push({ Name: 'profile', Status: 'Failed', Detail: `not a cabinet profile: ${path}` });
  } else {
    rows.push({ Name: 'RetroBat settings', Status: apply ? 'Done' : 'WhatIf', WhatIf: !apply, Detail: 'es_settings.cfg (backup first)' });
    if (state.vigemInstalled) {
      rows.push({ Name: 'ViGEmBus', Status: 'Skipped', Detail: 'already installed' });
    } else if (!autoInstall) {
      rows.push({ Name: 'ViGEmBus', Status: 'NeedsUser', Detail: 'driver missing; install it in the lightgun wizard or import with AutoInstall' });
    } else {
      // The command asks through -Approve; without -Approved the API answers no and hands the question back.
      approvals.push(VIGEM_APPROVAL);
      if (!apply) rows.push({ Name: 'ViGEmBus', Status: 'WhatIf', WhatIf: true, Detail: 'would install after approval' });
      else if (approved) {
        state.vigemInstalled = true;
        rows.push({ Name: 'ViGEmBus', Status: 'Done', Detail: 'installed' });
      } else rows.push({ Name: 'ViGEmBus', Status: 'NeedsUser', Detail: 'approval declined' });
    }
  }
  const order = ['Failed', 'NeedsUser', 'WhatIf', 'Done', 'Skipped'];
  const status = order.find((candidate) => rows.some((row) => row.Status === candidate)) ?? (apply ? 'Done' : 'WhatIf');
  const warnings = rows.filter((row) => row.Status === 'NeedsUser').map((row) => `${row.Name}: ${row.Detail}`);
  const errors = rows.filter((row) => row.Status === 'Failed').map((row) => `${row.Name}: ${row.Detail}`);
  if (apply && (status === 'Done' || status === 'Skipped')) state.importedProfiles = [...(state.importedProfiles ?? []), path];
  const message =
    status === 'WhatIf' ? `would import ${path}` : status === 'Done' || status === 'Skipped' ? `imported ${path}` : `${warnings.length + errors.length} item(s) need attention`;
  return finish(
    result({ operation, kind: 'Change', status, applied: apply, message, warnings, errors, approvals, data: { Result: rows }, startedAt }),
    anonymize,
  );
}

function stepOperation(name, { state, apply, approved, startedAt, anonymize, parameters = {} }) {
  const definition = STEPS.find((step) => step.name === name);
  void definition;

  if (!apply && state.dryRunFails) {
    // A kit that cannot produce a plan (precondition unmet, a person needed): the harness must stop right here.
    return finish(
      result({
        operation: name, kind: 'Change', status: 'NeedsUser',
        message: `Step "${name.split('.').slice(-2).join('-')}" needs you: precondition not met.`,
        errors: [`precondition not met for ${name}`],
        startedAt,
      }),
      anonymize,
    );
  }

  const needsApproval = name === 'step.lightgun.03-vigembus';
  const approvalText =
    'Install ViGEmBus 2.4.0 (publisher Nefarius Software, SHA-256 3f2a…c91d, valid signature). This writes to the system and starts a service.';

  if (needsApproval && !approved) {
    // Rule 2: without a person's yes every approval is declined and its text handed back to the client.
    const approvals = [approvalText];
    if (!apply) {
      return finish(
        result({
          operation: name, kind: 'Change', status: 'WhatIf',
          message: `would install ViGEmBus after ${approvalText.slice(0, 24)}…`,
          approvals,
          data: { Steps: [{ Name: 'vigembus', Status: 'WhatIf', WhatIf: true, Message: 'plan only', Duration: 0 }] },
          startedAt,
        }),
        anonymize,
      );
    }
    return finish(
      result({
        operation: name, kind: 'Change', status: 'NeedsUser', approvals,
        message: 'the step asks for an approval that was not given — call again with -Approved after a person said yes',
        data: { Steps: [{ Name: 'vigembus', Status: 'NeedsUser', WhatIf: false, Message: 'approval declined', Duration: 0 }] },
        startedAt,
      }),
      anonymize,
    );
  }

  if (!apply) {
    if (state.dryRunFails) {
      // A kit that cannot produce a plan (precondition unmet, needs a person): Failed, and the harness must stop.
      return finish(
        result({
          operation: name, kind: 'Change', status: 'NeedsUser',
          message: `Step "${name.split('.').slice(-2).join('-')}" needs you: precondition not met.`,
          errors: [`precondition not met for ${name}`],
          startedAt,
        }),
        anonymize,
      );
    }
    return finish(
      result({
        operation: name,
        kind: 'Change',
        status: 'WhatIf',
        message: `plan for ${name}: ${definition?.description ?? 'step'} (nothing written)`,
        changes: [],
        data: { Steps: [{ Name: name.split('.').pop(), Status: 'WhatIf', WhatIf: true, Message: 'would run', Duration: 0 }] },
        startedAt,
      }),
      anonymize,
    );
  }

  if (name === 'step.lightgun.01-detect') {
    state.retroBatRoot = typeof parameters.RetroBatRoot === 'string' && parameters.RetroBatRoot ? parameters.RetroBatRoot : SYNTH_RETROBAT;
    state.appliedSteps.push(name);
    return finish(
      result({
        operation: name, kind: 'Change', status: 'Done', applied: true,
        message: `found RetroBat in ${state.retroBatRoot}`,
        changes: [{ Kind: 'Setting', Target: 'RetroBatRoot', Detail: state.retroBatRoot }],
        data: { Steps: [{ Name: 'detect', Status: 'Done', WhatIf: false, Message: 'measured', Duration: 0.2 }] },
        startedAt,
      }),
      anonymize,
    );
  }

  if (needsApproval) {
    state.vigemInstalled = true;
    state.appliedSteps.push(name);
    return finish(
      result({
        operation: name, kind: 'Change', status: 'Done', applied: true,
        message: 'ViGEmBus 2.4.0 installed and running',
        changes: [{ Kind: 'Setting', Target: 'ViGEmBus', Detail: 'installed' }],
        backups: [`C:\\RetroBat\\state.json.bak_${name.split('.').pop()}`],
        approvals: [approvalText],
        data: { Steps: [{ Name: 'vigembus', Status: 'Done', WhatIf: false, Message: 'verified: service running', Duration: 12.5 }] },
        startedAt,
      }),
      anonymize,
    );
  }

  state.appliedSteps.push(name);
  return finish(
    result({
      operation: name, kind: 'Change', status: 'Done', applied: true,
      message: `${name} done`,
      changes: [{ Kind: 'File', Target: `C:\\RetroBat\\${name}.cfg`, Detail: 'written' }],
      backups: [`C:\\RetroBat\\${name}.cfg.bak_current`],
      data: { Steps: [{ Name: name.split('.').pop(), Status: 'Done', WhatIf: false, Message: 'verified', Duration: 1.0 }] },
      startedAt,
    }),
    anonymize,
  );
}

function parameterProblems(operation, parameters) {
  const spec = catalog().find((entry) => entry.Name === operation);
  if (!spec) return null; // unknown operation is reported by the caller
  for (const [key, value] of Object.entries(parameters)) {
    // PowerShell matches parameter names without regard to case, so the refusal has to as well.
    if (DENIED_PARAMETERS.has(key.toLowerCase()) || !spec.Parameters.some((p) => p.Name === key)) {
      return `Unknown parameter or not allowed through the API: ${key}`;
    }
    if (!isPlain(value)) return `Unknown parameter or not allowed through the API: ${key}`;
  }
  for (const param of spec.Parameters) {
    if (param.Mandatory && !(param.Name in parameters)) return `Missing parameter: ${param.Name}`;
  }
  return null;
}

function isPlain(value) {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return true;
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function refused(operation, message, startedAt) {
  const spec = catalog().find((entry) => entry.Name === operation);
  return result({ operation, kind: spec?.Kind, status: 'Failed', message, errors: [message], startedAt });
}

function result(input) {
  return {
    ApiVersion: API_VERSION,
    KitVersion: KIT_VERSION,
    Operation: input.operation,
    Kind: input.kind === 'Change' ? 'Change' : 'Read',
    Success: ['Ok', 'Done', 'Skipped', 'WhatIf'].includes(input.status),
    Status: input.status,
    Applied: Boolean(input.applied),
    Message: input.message ?? '',
    Warnings: input.warnings ?? [],
    Errors: input.errors ?? [],
    Changes: input.changes ?? [],
    Backups: input.backups ?? [],
    Approvals: input.approvals ?? [],
    Duration: input.duration ?? 0.05,
    StartedAt: input.startedAt ?? new Date().toISOString(),
    Data: input.data ?? null,
  };
}

/** The exit code rule of `Invoke-KitApi.ps1`: 0 success · 1 did not succeed · 2 refused. */
export function exitCodeFor(resultValue) {
  if (resultValue.Status === 'NotAvailable') return 2;
  if (resultValue.Status === 'Failed' && (resultValue.Errors ?? []).some((e) => /^(Unknown|Missing) parameter/.test(e))) return 2;
  return resultValue.Success ? 0 : 1;
}

function finish(resultValue, anonymize) {
  const output = anonymize ? anonymizeDeep(resultValue) : resultValue;
  return { result: output, exitCode: exitCodeFor(resultValue) };
}

/** Same rules as the kit's support bundle: names, profile paths, SIDs, private IPs and e-mails go, structure stays. */
export function anonymizeDeep(value) {
  if (typeof value === 'string') {
    let text = value;
    for (const [needle, replacement] of REPLACEMENTS) text = text.split(needle).join(replacement);
    return text;
  }
  if (Array.isArray(value)) return value.map(anonymizeDeep);
  if (value && typeof value === 'object') {
    const copy = {};
    for (const [key, item] of Object.entries(value)) copy[key] = anonymizeDeep(item);
    return copy;
  }
  return value;
}

/**
 * Parses the PowerShell argument vector of `Invoke-KitApi.ps1` the way the real script receives it:
 * `-Operation status -ParametersJson {...} -Apply -Approved -Anonymize -Culture de-DE`.
 * `-NoProfile -ExecutionPolicy Bypass -File <path>` is skipped, exactly like the shell does.
 */
export function parsePowerShellArgv(argv) {
  const request = { parameters: {} };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('-')) continue;
    const name = token.slice(1).toLowerCase();
    if (name === 'noprofile' || name === 'noninteractive') continue;
    if (name === 'executionpolicy' || name === 'file' || name === 'culture') {
      index += 1;
      if (name === 'culture') request.culture = argv[index];
      continue;
    }
    if (name === 'apply' || name === 'approved' || name === 'anonymize' || name === 'list') {
      // The harness never passes a value for a switch, exactly like the real script binds them.
      request[name] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined) continue;
    index += 1;
    if (name === 'operation') request.operation = value;
    else if (name === 'parametersjson') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) request.parameters = parsed;
        else request.parametersJsonError = 'not a JSON object';
      } catch (error) {
        request.parametersJsonError = `-ParametersJson: ${error.message}`;
      }
    }
  }
  return request;
}
