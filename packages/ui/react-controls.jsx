import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from './select.jsx';

// React-owned tools use the same native compositions and slots as DOM screens.
export const Button=React.forwardRef(function Button({className='',...props},ref){
  const primary=/(^|\s)(primary|wb-button-primary|cowart-primary)(\s|$)/.test(className);
  return <button {...props} ref={ref} className={className} data-hh-control="true" data-slot="button" data-variant={primary?'default':'outline'}/>;
});
export const Label=React.forwardRef(function Label(props,ref){return <label {...props} ref={ref} data-hh-control="true" data-slot="label"/>;});
export const Textarea=React.forwardRef(function Textarea(props,ref){return <textarea {...props} ref={ref} data-hh-control="true" data-slot="textarea"/>;});
export function Checkbox(props){return <span className="hh-checkbox-widget"><CheckboxPrimitive.Root {...props} className="hh-checkbox" data-slot="checkbox"><CheckboxPrimitive.Indicator data-slot="checkbox-indicator"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></CheckboxPrimitive.Indicator></CheckboxPrimitive.Root></span>;}
export function SelectField({children,value,onValueChange,disabled,id,'aria-label':label}){
  const options=React.Children.toArray(children),button=React.useRef(null);
  return <Select value={String(value)} onValueChange={onValueChange} disabled={disabled}><SelectTrigger id={id} aria-label={label} ref={button}><SelectValue/></SelectTrigger><SelectContent container={button.current?.closest('[data-ui-dialog][open]')||document.body}>{options.map(option=><SelectItem key={String(option.props.value)} value={String(option.props.value)} disabled={option.props.disabled}>{option.props.children}</SelectItem>)}</SelectContent></Select>;
}
