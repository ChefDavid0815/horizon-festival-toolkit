import {useEffect, useRef} from 'react';
// A hanko seal: wet (filled) marks a staged change, dry (outline) marks an archived record.
export function Seal({glyph, dry = false, className = ''}) {
  return <span className={`seal ${dry ? 'dry' : 'wet'} ${className}`} aria-hidden="true"><span>{glyph}</span></span>;
}
// Values change in place, character by character, without moving the surrounding grid.
export function Roll({value}) {
  const text = String(value ?? '—'), previous = useRef(text), changed = previous.current !== text;
  useEffect(() => { previous.current = text; });
  return <span className={`roll ${changed ? 'rolling' : ''}`} key={text}>{[...text].map((c, i) => <span key={i} style={{'--d': i}}>{c}</span>)}</span>;
}
export function PageHead({title, sub, children}) {
  return <header className="page-head"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{children ? <div className="page-actions">{children}</div> : null}</header>;
}
