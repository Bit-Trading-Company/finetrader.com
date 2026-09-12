/**
 * Design system primitives for the redesigned UI.
 *
 * Everything here is styled with CSS Modules and the `--ds-*` tokens from
 * src/styles/theme.css, and renders inside the app shell's `.ds-root`, which
 * opts out of the legacy global typography (see docs/ARCHITECTURE.md).
 *
 *   import { Button, Card, PageHeader } from '../../ui';
 */
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as Tabs } from './Tabs';
export { default as Table } from './Table';
export {
  Field,
  TextInput,
  NumberInput,
  Select,
  Checkbox,
  ChoiceGroup,
} from './Field';
export { Badge, Alert, Spinner, Loading, EmptyState } from './Feedback';
export { ScribbleUnderline, DoodleDivider, Marker } from './Scribble';
export { PageHeader, Section, Toolbar, StatGrid, StatTile } from './Layout';
