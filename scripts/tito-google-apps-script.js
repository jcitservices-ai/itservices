/**
 * JCIT TiTo Google Sheets automation.
 *
 * Install in the target Google Sheet:
 * Extensions > Apps Script > paste this file > Save.
 *
 * This mirrors the live portal flow:
 * - Authentication reads Employees: Email + Portal Password.
 * - Project/activity options read Settings & Validation.
 * - Writes are limited to Time Logs and Vacation Leave Requests.
 * - Time-in creates the employee row plus the paired Jay / Management row.
 * - Time-out closes both paired rows using the existing Notes column link.
 */

const TITO = {
  loginSheet: "Login / Logout",
  employeesSheet: "Employees",
  settingsSheet: "Settings & Validation",
  timeSheet: "Time Logs",
  leaveSheet: "Vacation Leave Requests",
  timeInCheckbox: "E8",
  timeOutCheckbox: "E11",
  teamMemberCell: "C8",
  projectCell: "C11",
  activityCell: "C14",
  managementMember: "Jay",
  managementActivity: "Management",
  timeHeaders: [
    "Log ID",
    "Date",
    "Team Member",
    "Project",
    "Activity",
    "Time In",
    "Time Out",
    "Total Hours",
    "Notes",
  ],
  leaveHeaders: [
    "Request Date",
    "Team Member",
    "Leave Type",
    "Start Date",
    "End Date",
    "Total Days",
    "Client / Project",
    "Proof of Leave",
    "Rule Validation",
    "Manager Status",
    "Notify Client?",
    "Auto-Log Time?",
  ],
};

const ALIASES = {
  logId: ["log id", "entry id", "time log id", "record id", "id"],
  date: ["date", "log date", "work date"],
  teamMember: ["team member", "member", "employee", "name"],
  project: ["project", "project name", "client", "client project"],
  activity: ["activity", "task", "work type"],
  timeIn: ["time in", "clock in", "clock-in", "start time"],
  timeOut: ["time out", "clock out", "clock-out", "end time"],
  hours: ["total hours", "hours", "work hours", "duration"],
  notes: ["notes", "note", "remarks", "comments"],
  email: ["email", "email address", "team email"],
  password: ["portal password", "password", "passcode", "pin", "team password", "login password"],
  passwordHash: ["password hash", "password_hash", "sha256", "sha256 password"],
  assignedProjects: ["project assigned", "assigned project", "assigned projects", "projects", "project"],
  approvedProjects: ["approved projects"],
  activities: ["specific activities"],
  leaveType: ["leave type", "type"],
  startDate: ["start date", "date start", "from", "date from"],
  endDate: ["end date", "date end", "to", "date to"],
  totalDays: ["total days", "day count", "days", "number of days", "leave days"],
  clientProject: ["client / project", "client/project", "client project", "project", "project name"],
  proof: ["proof of leave", "proof", "leave proof", "attachment", "file"],
  ruleValidation: ["rule validation"],
  managerStatus: ["manager status", "manager approval", "status"],
  notifyClient: ["notify client?", "notify client", "client notification"],
  autoLogTime: ["auto-log time?", "auto log time", "auto-log time"],
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("JCIT TiTo")
    .addItem("Initialize Missing TiTo Sheets", "setupTiToSheets")
    .addToUi();
}

function setupTiToSheets() {
  ensureSheet_(TITO.timeSheet, TITO.timeHeaders);
  ensureSheet_(TITO.leaveSheet, TITO.leaveHeaders);
}

function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  if (sheet.getName() !== TITO.loginSheet) return;

  const address = e.range.getA1Notation();
  const checked = e.range.getValue() === true;

  if (address === TITO.timeInCheckbox && checked) {
    handleSheetTimeIn_(sheet);
  }

  if (address === TITO.timeOutCheckbox && checked) {
    handleSheetTimeOut_(sheet);
  }
}

function handleSheetTimeIn_(loginSheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const teamMember = String(loginSheet.getRange(TITO.teamMemberCell).getValue() || "").trim();
  const project = String(loginSheet.getRange(TITO.projectCell).getValue() || "").trim();
  const activity = String(loginSheet.getRange(TITO.activityCell).getValue() || "").trim();

  if (!teamMember || !project || !activity) {
    resetLoginCheckbox_(loginSheet, TITO.timeInCheckbox);
    ss.toast("Please select a Team Member, Project, and Activity before logging in.", "Missing Information", 6);
    return;
  }

  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    const result = clockInByTeamMember_(teamMember, project, activity, "");
    clearLoginForm_(loginSheet);
    ss.toast(result.message, "Login Successful", 5);
  } catch (error) {
    resetLoginCheckbox_(loginSheet, TITO.timeInCheckbox);
    ss.toast(error.message, "Login Error", 6);
  } finally {
    if (locked) lock.releaseLock();
  }
}

function handleSheetTimeOut_(loginSheet) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const teamMember = String(loginSheet.getRange(TITO.teamMemberCell).getValue() || "").trim();

  if (!teamMember) {
    resetLoginCheckbox_(loginSheet, TITO.timeOutCheckbox);
    ss.toast("Please select your Team Member name to log out.", "Missing Information", 6);
    return;
  }

  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    lock.waitLock(15000);
    locked = true;
    const result = clockOutByTeamMember_(teamMember, "");
    clearLoginForm_(loginSheet);
    ss.toast(result.message, "Logout Successful", 5);
  } catch (error) {
    resetLoginCheckbox_(loginSheet, TITO.timeOutCheckbox);
    ss.toast(error.message, "Logout Error", 6);
  } finally {
    if (locked) lock.releaseLock();
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    verifyToken_(payload.token);
    const action = String(payload.action || "").toLowerCase();

    if (action === "login") return json_(handleLogin_(payload));
    if (action === "clock") return json_(handleClock_(payload));
    if (action === "leave") return json_(handleLeave_(payload));

    throw new Error("Unknown TiTo action.");
  } catch (error) {
    return json_({ ok: false, message: error.message });
  }
}

function handleLogin_(payload) {
  const member = findMember_(payload.email || payload.username, payload.password);
  return {
    ok: true,
    member: safeMember_(member),
    projects: projectsForMember_(member),
    activities: activitiesForPortal_(),
    activeShift: findActiveShiftForMember_(member.teamMember),
  };
}

function handleClock_(payload) {
  const member = findMember_(payload.email || payload.username, payload.password);
  const action = String(payload.clockAction || payload.actionType || "").toLowerCase();
  const project = String(payload.project || "").trim();
  const activity = String(payload.activity || "Client Work").trim();
  const notes = String(payload.notes || "").trim();

  if (action === "time_in") {
    if (!project) throw new Error("Project is required.");
    if (!activity) throw new Error("Activity is required.");
    const result = clockInByTeamMember_(member.teamMember, project, activity, notes);
    return { ok: true, message: result.message, activeShift: result.activeShift };
  }

  if (action === "time_out") {
    const result = clockOutByTeamMember_(member.teamMember, notes);
    return { ok: true, message: result.message, activeShift: null };
  }

  throw new Error("Clock action must be time_in or time_out.");
}

function handleLeave_(payload) {
  const member = findMember_(payload.email || payload.username, payload.password);
  const leaveType = String(payload.leaveType || "").trim();
  if (["Vacation", "Sick", "Emergency"].indexOf(leaveType) === -1) {
    throw new Error("Leave type must be Vacation, Sick, or Emergency.");
  }

  const start = new Date(String(payload.startDate || "") + "T00:00:00");
  const end = new Date(String(payload.endDate || "") + "T00:00:00");
  if (!isFinite(start.getTime()) || !isFinite(end.getTime()) || end < start) {
    throw new Error("Leave end date must be on or after the start date.");
  }

  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  appendLeaveRequest_(member, {
    leaveType,
    startDate: payload.startDate,
    endDate: payload.endDate,
    days,
    clientProject: String(payload.clientProject || "").trim(),
    proofUrl: String(payload.proofUrl || "").trim(),
    notifyClient: payload.notifyClient ? "TRUE" : "FALSE",
    autoLogTime: payload.autoLogTime ? "TRUE" : "FALSE",
  });

  return { ok: true, message: "Leave request submitted." };
}

function clockInByTeamMember_(teamMember, project, activity, notes) {
  const sheet = ensureSheet_(TITO.timeSheet, TITO.timeHeaders);
  if (findActiveShiftForMember_(teamMember)) {
    throw new Error(teamMember + " is already logged in. Please log out of the active session first.");
  }

  const ids = nextLogIds_(sheet);
  const now = new Date();
  const row = {
    logId: ids.memberLogId,
    date: formatDate_(now),
    teamMember,
    project,
    activity,
    timeIn: formatTime_(now),
    timeOut: "",
    hours: "",
    notes,
  };

  appendTimeLog_(sheet, row);

  const hasManagementPair = !isManagementMember_(teamMember);
  if (hasManagementPair) {
    appendTimeLog_(sheet, {
      logId: ids.managementLogId,
      date: row.date,
      teamMember: TITO.managementMember,
      project,
      activity: TITO.managementActivity,
      timeIn: row.timeIn,
      timeOut: "",
      hours: "",
      notes: ids.memberLogId,
    });
  }

  return {
    message: "Logged Time In for " + teamMember + (hasManagementPair ? " (+ Management session)" : ""),
    activeShift: {
      entryId: ids.memberLogId,
      managementEntryId: hasManagementPair ? ids.managementLogId : "",
      teamMember,
      project,
      activity,
      timeIn: now,
      notes,
    },
  };
}

function clockOutByTeamMember_(teamMember, notes) {
  const sheet = ensureSheet_(TITO.timeSheet, TITO.timeHeaders);
  const active = findActiveShiftForMember_(teamMember);
  if (!active) throw new Error("No active Time In record found for " + teamMember + ".");

  const now = new Date();
  const timeOut = formatTime_(now);
  closeTimeLog_(sheet, active.rowNumber, timeOut, notes || active.notes || "");

  const management = isManagementMember_(teamMember) ? null : findOpenManagementShift_(sheet, active);
  if (management) {
    closeTimeLog_(sheet, management.rowNumber, timeOut, management.notes || active.entryId);
  }

  return {
    message: "Successfully logged Time Out for " + teamMember + (management ? " and finalized Management session." : ""),
  };
}

function appendLeaveRequest_(member, request) {
  const sheet = ensureSheet_(TITO.leaveSheet, TITO.leaveHeaders);
  const headers = getHeaders_(sheet);
  const row = blankRow_(headers);

  setValue_(row, headers, ["request date", "submitted at", "created at"], formatDate_(new Date()));
  setValue_(row, headers, ALIASES.teamMember, member.teamMember);
  setValue_(row, headers, ALIASES.leaveType, request.leaveType);
  setValue_(row, headers, ALIASES.startDate, request.startDate);
  setValue_(row, headers, ALIASES.endDate, request.endDate);
  setValue_(row, headers, ALIASES.totalDays, request.days);
  setValue_(row, headers, ALIASES.clientProject, request.clientProject);
  setValue_(row, headers, ALIASES.proof, request.proofUrl);
  setValue_(row, headers, ALIASES.ruleValidation, "");
  setValue_(row, headers, ALIASES.managerStatus, "Pending");
  setValue_(row, headers, ALIASES.notifyClient, request.notifyClient);
  setValue_(row, headers, ALIASES.autoLogTime, request.autoLogTime);

  sheet.appendRow(trimTrailing_(row));
}

function appendTimeLog_(sheet, values) {
  const headers = getHeaders_(sheet);
  const row = blankRow_(headers);

  setValue_(row, headers, ALIASES.logId, values.logId);
  setValue_(row, headers, ALIASES.date, values.date);
  setValue_(row, headers, ALIASES.teamMember, values.teamMember);
  setValue_(row, headers, ALIASES.project, values.project);
  setValue_(row, headers, ALIASES.activity, values.activity);
  setValue_(row, headers, ALIASES.timeIn, values.timeIn);
  setValue_(row, headers, ALIASES.timeOut, values.timeOut);
  setValue_(row, headers, ALIASES.hours, values.hours);
  setValue_(row, headers, ALIASES.notes, values.notes);

  sheet.appendRow(trimTrailing_(row));
}

function closeTimeLog_(sheet, rowNumber, timeOut, notes) {
  const headers = getHeaders_(sheet);
  const timeOutCol = findColumn_(headers, ALIASES.timeOut);
  const hoursCol = findColumn_(headers, ALIASES.hours);
  const notesCol = findColumn_(headers, ALIASES.notes);

  if (timeOutCol === -1 || hoursCol === -1) throw new Error("Time Logs tab is missing Time Out or Total Hours.");

  sheet.getRange(rowNumber, timeOutCol + 1).setValue(timeOut);
  sheet.getRange(rowNumber, hoursCol + 1).setFormula(durationFormula_(headers, rowNumber));
  if (notesCol !== -1) sheet.getRange(rowNumber, notesCol + 1).setValue(notes);
}

function findActiveShiftForMember_(teamMember) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TITO.timeSheet);
  if (!sheet || sheet.getLastRow() < 2) return null;

  const headers = getHeaders_(sheet);
  const teamCol = findColumn_(headers, ALIASES.teamMember);
  const activityCol = findColumn_(headers, ALIASES.activity);
  const timeOutCol = findColumn_(headers, ALIASES.timeOut);
  const notesCol = findColumn_(headers, ALIASES.notes);
  const logIdCol = findColumn_(headers, ALIASES.logId);
  const projectCol = findColumn_(headers, ALIASES.project);
  const timeInCol = findColumn_(headers, ALIASES.timeIn);
  const dateCol = findColumn_(headers, ALIASES.date);

  if (teamCol === -1 || timeOutCol === -1) return null;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const target = normalize_(teamMember);
  const targetIsManagement = isManagementMember_(teamMember);

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    const rowMember = normalize_(row[teamCol]);
    const activity = activityCol === -1 ? "" : normalize_(row[activityCol]);
    const notes = notesCol === -1 ? "" : String(row[notesCol] || "").trim();

    if (rowMember !== target) continue;
    if (row[timeOutCol]) continue;
    if (targetIsManagement && activity === normalize_(TITO.managementActivity) && notes) continue;

    return {
      rowNumber: index + 2,
      entryId: logIdCol === -1 ? "" : String(row[logIdCol] || "").trim(),
      teamMember: row[teamCol],
      project: projectCol === -1 ? "" : row[projectCol],
      activity: activityCol === -1 ? "" : row[activityCol],
      timeIn: sheetDateTime_(dateCol === -1 ? "" : row[dateCol], timeInCol === -1 ? "" : row[timeInCol]),
      notes,
    };
  }

  return null;
}

function findOpenManagementShift_(sheet, active) {
  const headers = getHeaders_(sheet);
  const teamCol = findColumn_(headers, ALIASES.teamMember);
  const projectCol = findColumn_(headers, ALIASES.project);
  const timeOutCol = findColumn_(headers, ALIASES.timeOut);
  const notesCol = findColumn_(headers, ALIASES.notes);
  const logIdCol = findColumn_(headers, ALIASES.logId);

  if (teamCol === -1 || timeOutCol === -1 || notesCol === -1 || sheet.getLastRow() < 2) return null;

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const activeId = normalize_(active.entryId);
  const activeProject = normalize_(active.project);

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (!isManagementMember_(row[teamCol])) continue;
    if (row[timeOutCol]) continue;
    if (normalize_(row[notesCol]) !== activeId) continue;
    return {
      rowNumber: index + 2,
      entryId: logIdCol === -1 ? "" : String(row[logIdCol] || "").trim(),
      notes: String(row[notesCol] || "").trim(),
    };
  }

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const row = values[index];
    if (!isManagementMember_(row[teamCol])) continue;
    if (row[timeOutCol]) continue;
    if (projectCol === -1 || normalize_(row[projectCol]) !== activeProject) continue;
    return {
      rowNumber: index + 2,
      entryId: logIdCol === -1 ? "" : String(row[logIdCol] || "").trim(),
      notes: String(row[notesCol] || "").trim(),
    };
  }

  return null;
}

function nextLogIds_(sheet) {
  const headers = getHeaders_(sheet);
  const logIdCol = findColumn_(headers, ALIASES.logId);
  let max = 1000;

  if (logIdCol !== -1 && sheet.getLastRow() > 1) {
    const values = sheet.getRange(2, logIdCol + 1, sheet.getLastRow() - 1, 1).getValues();
    values.forEach((row) => {
      const match = String(row[0] || "").trim().match(/^LOG-(\d+)$/i);
      if (!match) return;
      const value = Number(match[1]);
      if (isFinite(value)) max = Math.max(max, value);
    });
  }

  return {
    memberLogId: "LOG-" + (max + 1),
    managementLogId: "LOG-" + (max + 2),
  };
}

function findMember_(email, password) {
  const login = String(email || "").trim().toLowerCase();
  const sheet = SpreadsheetApp.getActive().getSheetByName(TITO.employeesSheet);
  if (!sheet) throw new Error("Employees tab was not found.");
  if (!login || !password) throw new Error("Email address and password are required.");

  const rows = tableRows_(sheet);
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    const user = valueFor_(row, ALIASES.email);
    if (!user || user.toLowerCase() !== login) continue;

    const stored = valueFor_(row, ALIASES.password);
    const hash = valueFor_(row, ALIASES.passwordHash).replace(/^sha256:/i, "").trim();
    const valid = hash ? sha256_(password) === hash.toLowerCase() : stored && stored === String(password || "");
    if (!valid) continue;

    const name = String(row.values.Name || row.values["Full Name"] || row.values["Team Member"] || user).trim();
    const teamMember = String(row.values["Team Member"] || row.values.Name || user).trim();

    return {
      username: user,
      email: user,
      name,
      teamMember,
      assignedProjects: split_(valueFor_(row, ALIASES.assignedProjects)),
    };
  }

  throw new Error("Invalid email address or password.");
}

function projectsForMember_(member) {
  const found = {};
  member.assignedProjects.forEach((project) => {
    if (project) found[project] = true;
  });

  const sheet = SpreadsheetApp.getActive().getSheetByName(TITO.settingsSheet);
  if (sheet) {
    tableRows_(sheet).forEach((row) => {
      const project = valueFor_(row, ALIASES.approvedProjects);
      if (project) found[project] = true;
    });
  }

  return Object.keys(found).sort();
}

function activitiesForPortal_() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(TITO.settingsSheet);
  const found = {};
  if (!sheet) return [];

  tableRows_(sheet).forEach((row) => {
    const activity = valueFor_(row, ALIASES.activities);
    if (activity) found[activity] = true;
  });

  return Object.keys(found).sort();
}

function ensureSheet_(name, headers) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sheet;
}

function getHeaders_(sheet) {
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
}

function tableRows_(sheet) {
  const values = sheet.getDataRange().getValues();
  const headers = (values.shift() || []).map(String);
  return values.map((row, index) => {
    const item = { rowNumber: index + 2, headers, values: {} };
    headers.forEach((header, column) => {
      item.values[header] = row[column];
    });
    return item;
  });
}

function valueFor_(row, aliases) {
  const header = row.headers.find((item) => aliases.some((alias) => normalize_(alias) === normalize_(item)));
  return header ? String(row.values[header] || "").trim() : "";
}

function findColumn_(headers, aliases) {
  for (let i = 0; i < headers.length; i += 1) {
    if (aliases.some((alias) => normalize_(alias) === normalize_(headers[i]))) return i;
  }
  return -1;
}

function setValue_(row, headers, aliases, value) {
  const index = findColumn_(headers, aliases);
  if (index !== -1) row[index] = value;
}

function blankRow_(headers) {
  return new Array(headers.length).fill("");
}

function trimTrailing_(row) {
  let last = row.length - 1;
  while (last > 0 && row[last] === "") last -= 1;
  return row.slice(0, last + 1);
}

function durationFormula_(headers, rowNumber) {
  const timeInCol = findColumn_(headers, ALIASES.timeIn);
  const timeOutCol = findColumn_(headers, ALIASES.timeOut);
  return "=(" + columnLetter_(timeOutCol) + rowNumber + "-" + columnLetter_(timeInCol) + rowNumber + ")*24";
}

function columnLetter_(index) {
  let value = index + 1;
  let letters = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function formatDate_(date) {
  return Utilities.formatDate(date, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "yyyy-MM-dd");
}

function formatTime_(date) {
  return Utilities.formatDate(date, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), "HH:mm:ss");
}

function sheetDateTime_(dateValue, timeValue) {
  const dateText = dateValue instanceof Date ? formatDate_(dateValue) : String(dateValue || "");
  const timeText = timeValue instanceof Date ? formatTime_(timeValue) : String(timeValue || "");
  return new Date((dateText + " " + timeText).trim());
}

function isManagementMember_(value) {
  return normalize_(value) === normalize_(TITO.managementMember);
}

function normalize_(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function split_(value) {
  return String(value || "").split(/[,;\n|]+/).map((item) => item.trim()).filter(Boolean);
}

function safeMember_(member) {
  return {
    username: member.username,
    name: member.name,
    teamMember: member.teamMember,
    email: member.email,
  };
}

function sha256_(value) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ""))
    .map((byte) => (byte + 256).toString(16).slice(-2))
    .join("");
}

function verifyToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty("TITO_PUBLIC_TOKEN");
  if (expected && token !== expected) throw new Error("Invalid TiTo token.");
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function resetLoginCheckbox_(sheet, cell) {
  sheet.getRange(cell).setValue(false);
}

function clearLoginForm_(sheet) {
  resetLoginCheckbox_(sheet, TITO.timeInCheckbox);
  resetLoginCheckbox_(sheet, TITO.timeOutCheckbox);
  sheet.getRange(TITO.teamMemberCell).clearContent();
  sheet.getRange(TITO.projectCell).clearContent();
  sheet.getRange(TITO.activityCell).clearContent();
}
