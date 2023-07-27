import React from 'react';
import { createRoot } from 'react-dom/client';
import ControlBox from './control_box';

const root = createRoot(document.getElementById('control_box')); // createRoot(container!) if you use TypeScript
root.render(<React.StrictMode>
  <ControlBox />
</React.StrictMode>);