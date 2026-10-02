// Test-only navigation adapter; production uses Next's real Link.
import type {ComponentProps} from 'react';
export default function Link(props:ComponentProps<'a'>){return <a {...props}/>;}
