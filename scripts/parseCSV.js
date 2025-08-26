function parseCSV(text){
  const rows=[]; let field="", row=[], inQ=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(inQ){
      if(c==='"'){ if(text[i+1]==='"'){ field+='"'; i++; } else inQ=false; }
      else field+=c;
    } else {
      if(c==='"') inQ=true;
      else if(c===','){ row.push(field); field=""; }
      else if(c==='\n'){ row.push(field); rows.push(row); row=[]; field=""; }
      else if(c!=='\r'){ field+=c; }
    }
  }
  row.push(field);
  if(row.length>1 || row[0]!=="") rows.push(row);
  return rows;
}

if (typeof module !== 'undefined') module.exports = parseCSV;
if (typeof window !== 'undefined') window.parseCSV = parseCSV;
