// =============================================
// WebReview — Google Apps Script
// =============================================
// INSTRUCTIONS:
// 1. Go to Google Sheets → create a new spreadsheet
// 2. Go to Extensions → Apps Script
// 3. Delete everything and paste this entire code
// 4. Click Deploy → New deployment
// 5. Select type: Web app
// 6. Set "Who has access" to: Anyone
// 7. Click Deploy and copy the URL
// 8. Paste the URL in WebReview Settings → Test Connection
// =============================================

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var action = e.parameter.action;
  var output;

  if (action === 'ping') {
    output = ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', sheet: sheet.getName() })
    ).setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  if (action === 'setup') {
    var headers = sheet.getRange(1, 1, 1, 10).getValues()[0];
    if (!headers[0]) {
      sheet.getRange(1, 1, 1, 10).setValues([[
        'ID', 'Project', 'URL', 'Comment',
        'Priority', 'Status', 'Device',
        'Position', 'Timestamp', 'Updated'
      ]]);
      sheet.getRange(1, 1, 1, 10)
        .setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('white');
      sheet.setFrozenRows(1);
    }
    output = ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', message: 'Headers set' })
    ).setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  if (action === 'add') {
    var data = JSON.parse(e.parameter.data);
    sheet.appendRow([
      data.id,
      data.project || '',
      data.url || '',
      data.comment || '',
      data.priority || 'normal',
      data.status || 'open',
      data.device || 'desktop',
      data.x + '%, ' + data.y + '%',
      data.timestamp || new Date().toISOString(),
      new Date().toISOString()
    ]);
    output = ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', row: sheet.getLastRow() })
    ).setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  if (action === 'update') {
    var data = JSON.parse(e.parameter.data);
    var rows = sheet.getDataRange().getValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]) === String(data.id)) {
        if (data.status) sheet.getRange(i + 1, 6).setValue(data.status);
        if (data.comment) sheet.getRange(i + 1, 4).setValue(data.comment);
        sheet.getRange(i + 1, 10).setValue(new Date().toISOString());
        break;
      }
    }
    output = ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  if (action === 'sync') {
    var data = JSON.parse(e.parameter.data);
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 10).clear();
    }
    data.items.forEach(function(item) {
      sheet.appendRow([
        item.id,
        data.project || '',
        item.url || '',
        item.comment || '',
        item.priority || 'normal',
        item.status || 'open',
        item.device || 'desktop',
        (item.x || 0) + '%, ' + (item.y || 0) + '%',
        item.timestamp || new Date().toISOString(),
        new Date().toISOString()
      ]);
    });
    output = ContentService.createTextOutput(
      JSON.stringify({ status: 'ok', synced: data.items.length })
    ).setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  if (action === 'delete') {
    var id = e.parameter.id;
    var rows = sheet.getDataRange().getValues();
    for (var i = rows.length - 1; i >= 1; i--) {
      if (String(rows[i][0]) === String(id)) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    output = ContentService.createTextOutput(
      JSON.stringify({ status: 'ok' })
    ).setMimeType(ContentService.MimeType.JSON);
    return output;
  }

  output = ContentService.createTextOutput(
    JSON.stringify({ status: 'error', message: 'Unknown action' })
  ).setMimeType(ContentService.MimeType.JSON);
  return output;
}
