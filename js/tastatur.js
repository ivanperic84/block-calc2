// BlockCalc — js/tastatur.js
// Tastaturkürzel
// INIT
// ════════════════════════════════════════════
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey) && e.key==='s'){ e.preventDefault(); saveProject(); }
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key==='z'){ e.preventDefault(); histUndo(); }
  if((e.ctrlKey||e.metaKey) && (e.key==='y' || (e.shiftKey && e.key==='z'))){ e.preventDefault(); histRedo(); }
  // Enter in Eingabefeld: Wert bestätigen (Feld verlassen + sofortige Neuberechnung)
  if(e.key==='Enter' && e.target.matches('input[type="number"],input[type="text"],input[type="date"]')){
    e.preventDefault();
    e.target.blur();
    scheduleCalc(0);
  }
});
// ════════════════════════════════════════════
