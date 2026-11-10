// The same records and actions are used on every screen size.
export function prepareResponsiveContent(root){
  for(const input of root.querySelectorAll('input[type="number"]'))input.inputMode='numeric';
  for(const table of root.querySelectorAll('table')){
    const headers=[...table.querySelectorAll('thead th')];
    if(!headers.length)continue;
    table.classList.add('mobile-records');
    table.setAttribute('role','table');
    for(const group of table.querySelectorAll('thead,tbody'))group.setAttribute('role','rowgroup');
    for(const row of table.querySelectorAll('tr'))row.setAttribute('role','row');
    headers.forEach(header=>header.setAttribute('role','columnheader'));
    for(const row of table.querySelectorAll('tbody tr'))[...row.cells].forEach((cell,index)=>{
      const label=headers[index]?.textContent.trim().toLocaleLowerCase('uz')||'';
      cell.dataset.label=label?label[0].toLocaleUpperCase('uz')+label.slice(1):'';
      cell.setAttribute('role','cell');
    });
  }
}
