/**
 * Living style guide for the redesign (/design).
 *
 * Every primitive in src/ui shown in its states, plus the tokens behind them.
 * Use it to review the design language and to check a component before using
 * it on a page.
 */
import React, { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  ChoiceGroup,
  DoodleDivider,
  EmptyState,
  Field,
  IconButton,
  Loading,
  Marker,
  NumberInput,
  PageHeader,
  Section,
  Select,
  SettingsLayout,
  Spinner,
  StatGrid,
  StatTile,
  Switch,
  Table,
  Tabs,
  TextInput,
  Toggle,
  Toolbar,
} from '../../ui';
import { BoltIcon, EyeIcon, SettingsIcon } from '../../ui/icons';
import styles from './DesignSystem.module.css';

const SURFACE_TOKENS = [
  '--ds-surface-app',
  '--ds-surface-sunken',
  '--ds-surface',
  '--ds-surface-raised',
  '--ds-surface-overlay',
  '--ds-surface-hover',
  '--ds-border',
  '--ds-border-strong',
];

const STATE_TOKENS = [
  '--ds-accent',
  '--ds-accent-hover',
  '--ds-success',
  '--ds-danger',
  '--ds-warning',
  '--ds-info',
  '--ds-text',
  '--ds-text-muted',
];

const TYPE_SPECIMENS = [
  {
    label: 'display-lg / Mix Doodle',
    className: styles.display,
    text: 'Fine auto-trader',
  },
  {
    label: 'text-xl / sans 20',
    style: { fontSize: 'var(--ds-text-xl)' },
    text: 'Proxy wallets',
  },
  {
    label: 'text-lg / sans 16',
    style: { fontSize: 'var(--ds-text-lg)' },
    text: 'Select a collection to trade',
  },
  {
    label: 'text-md / sans 14',
    style: { fontSize: 'var(--ds-text-md)' },
    text: 'Body copy sits at fourteen pixels.',
  },
  {
    label: 'mono / figures',
    className: styles.mono,
    text: '0.00412500 BTC · bc1p7f…9x2q',
  },
];

const SAMPLE_WALLETS = [
  {
    address: 'bc1p7f0q…9x2q',
    balance: '0.04120000',
    items: 3,
    listed: 1,
    status: 'ready',
  },
  {
    address: 'bc1pk39d…4m7e',
    balance: '0.00250000',
    items: 0,
    listed: 0,
    status: 'low',
  },
  {
    address: 'bc1pz84m…1c5t',
    balance: '0.01980000',
    items: 2,
    listed: 2,
    status: 'pending',
  },
];

const STATUS_TONE = { ready: 'success', low: 'warning', pending: 'info' };

const DesignSystem = () => {
  const [tab, setTab] = useState('simple');
  const [pill, setPill] = useState('satflow');
  const [exchange, setExchange] = useState('satflow');
  const [useFees, setUseFees] = useState(true);
  const [amount, setAmount] = useState(1);
  const [view, setView] = useState('simple');
  const [frameOn, setFrameOn] = useState(false);

  return (
    <div className={`ds-root ${styles.page}`}>
      <div className={styles.inner}>
        <PageHeader
          title="Design system"
          description="The primitives the redesign is built from. Everything uses the --ds-* tokens, so a change here lands everywhere."
          actions={<Button variant="secondary">Docs</Button>}
        />

        <Section
          title="Buttons"
          description="Primary for the one action that matters on a screen."
        >
          <div className={styles.stack}>
            <div className={styles.row}>
              <Button>Start trading</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Stop</Button>
            </div>
            <div className={styles.row}>
              <Button size="sm">Small</Button>
              <Button size="md">Medium</Button>
              <Button size="lg">Large</Button>
              <Button loading>Working</Button>
              <Button disabled>Disabled</Button>
            </div>
          </div>
        </Section>

        <Section title="Cards">
          <div className={styles.grid}>
            <Card
              title="Wallet 3"
              subtitle="bc1p7f0q…9x2q"
              actions={
                <Badge tone="success" dot>
                  Ready
                </Badge>
              }
            >
              <p>Cards hold every panel, list and form section.</p>
            </Card>
            <Card
              tone="raised"
              title="Raised"
              footer={<Button size="sm">Action</Button>}
            >
              <p>Raised cards sit above the page, for modals and popovers.</p>
            </Card>
            <Card tone="quiet" title="Quiet">
              <p>Quiet cards group content without drawing a box around it.</p>
            </Card>
          </div>
        </Section>

        <Section title="Tabs">
          <div className={styles.stack}>
            <Tabs
              items={[
                { id: 'simple', label: 'Simple' },
                { id: 'advanced', label: 'Advanced' },
                { id: 'history', label: 'History', disabled: true },
              ]}
              value={tab}
              onChange={setTab}
            />
            <Tabs
              variant="pills"
              items={[
                { id: 'satflow', label: 'Satflow' },
                { id: 'ordnet', label: 'ord.net' },
              ]}
              value={pill}
              onChange={setPill}
            />
          </div>
        </Section>

        <Section
          title="Toggles and switches"
          description="A toggle changes how one thing is shown; tabs move between different things. A switch takes effect the moment it is flipped — use a checkbox inside a form the reader submits."
        >
          <div className={styles.stack}>
            <div className={styles.row}>
              <Toggle
                options={[
                  { id: 'simple', label: 'Simple' },
                  { id: 'advanced', label: 'Advanced' },
                ]}
                value={view}
                onChange={setView}
                ariaLabel="Example view"
              />
              <IconButton label="Settings">
                <SettingsIcon />
              </IconButton>
              <IconButton label="Settings" variant="surface" active>
                <SettingsIcon />
              </IconButton>
            </div>

            <Switch
              label="Hand-drawn frame"
              hint="Switches read as settings, so they carry their own label and hint."
              checked={frameOn}
              onChange={setFrameOn}
            />
          </div>
        </Section>

        <Section
          title="Surfaces"
          description="Two global classes carry the app's character. `ds-panel` is the frosted sheet every top-level panel uses — never nest one inside another. `ds-frame` is the hand-drawn border, reserved for the whole content column and off unless the reader turns it on."
        >
          <div className={styles.grid}>
            <div className={`ds-panel ${styles.sample}`}>
              <strong>ds-panel</strong>
              <p>
                Frosted, borderless, separated by translucency and an edge
                highlight rather than an outline.
              </p>
            </div>
            <div className={`ds-frame ${styles.sampleFramed}`}>
              <strong>ds-frame</strong>
              <p>
                The marker border, thinned with --ds-frame-scale. One per screen
                at most.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Settings layout"
          description="Categories on the left, the chosen one on the right — for dialogs holding more than one kind of setting."
        >
          <SettingsLayout
            sections={[
              {
                id: 'run',
                label: 'Run',
                icon: <BoltIcon size={16} />,
                description: 'What a run does.',
                render: () => (
                  <Checkbox
                    label="Pay the app fee"
                    hint="Adds the Fine Trader fee output to trades."
                    checked={useFees}
                    onChange={(e) => setUseFees(e.target.checked)}
                  />
                ),
              },
              {
                id: 'display',
                label: 'Display',
                icon: <EyeIcon size={16} />,
                description: 'How the app looks.',
                render: () => (
                  <Switch
                    label="Frosted panels"
                    hint="Turn off for flat surfaces."
                    checked={frameOn}
                    onChange={setFrameOn}
                  />
                ),
              },
            ]}
          />
        </Section>

        <Section title="Forms">
          <div className={styles.grid}>
            <Field
              label="Trade price (BTC)"
              hint="Defaults to the collection floor."
            >
              <NumberInput
                value={amount}
                step="0.00000001"
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <Field
              label="Destination address"
              error="That is not a valid address."
            >
              <TextInput mono invalid defaultValue="bc1p…" />
            </Field>
            <Field label="Mempool provider">
              <Select defaultValue="mempool.space">
                <option>mempool.space</option>
                <option>blockstream.info</option>
              </Select>
            </Field>
            <Field label="Fees">
              <Checkbox
                label="Send trading fee"
                hint="1% of each purchase."
                checked={useFees}
                onChange={(e) => setUseFees(e.target.checked)}
              />
            </Field>
          </div>
          <div style={{ marginTop: 'var(--ds-space-4)' }}>
            <Field label="Marketplace">
              <ChoiceGroup
                name="exchange"
                direction="row"
                value={exchange}
                onChange={setExchange}
                options={[
                  {
                    value: 'satflow',
                    label: 'Satflow',
                    hint: 'Listings, bids, secure purchase',
                  },
                  {
                    value: 'ordnet',
                    label: 'ord.net',
                    hint: 'Needs a signed-in wallet',
                  },
                ]}
              />
            </Field>
          </div>
        </Section>

        <Section title="Status">
          <div className={styles.stack}>
            <div className={styles.row}>
              <Badge>Neutral</Badge>
              <Badge tone="accent">Accent</Badge>
              <Badge tone="success" dot>
                Confirmed
              </Badge>
              <Badge tone="warning" dot>
                Pending
              </Badge>
              <Badge tone="danger" dot>
                Failed
              </Badge>
              <Badge tone="info">ord.net</Badge>
            </div>
            <Alert tone="info" title="Auto-trading started">
              Listing ready items, then buying from the next wallet.
            </Alert>
            <Alert tone="danger" title="Trading stopped after an error">
              Could not load UTXOs for bc1p7f0q…9x2q.
            </Alert>
            <div className={styles.row}>
              <Spinner />
              <span>Inline spinner</span>
            </div>
            <Card padding="none">
              <Loading>Fetching wallet balances…</Loading>
            </Card>
          </div>
        </Section>

        <Section title="Data">
          <Toolbar
            left={<Badge tone="accent">3 wallets</Badge>}
            right={
              <Button size="sm" variant="secondary">
                Refresh
              </Button>
            }
          />
          <Card padding="none">
            <Table
              columns={[
                {
                  key: 'address',
                  header: 'Wallet',
                  render: (row) => (
                    <span className={styles.mono}>{row.address}</span>
                  ),
                },
                {
                  key: 'balance',
                  header: 'Balance (BTC)',
                  align: 'right',
                  numeric: true,
                  render: (row) => row.balance,
                },
                {
                  key: 'items',
                  header: 'Items',
                  align: 'right',
                  numeric: true,
                  render: (row) => row.items,
                },
                {
                  key: 'listed',
                  header: 'Listed',
                  align: 'right',
                  numeric: true,
                  render: (row) => row.listed,
                },
                {
                  key: 'status',
                  header: 'Status',
                  render: (row) => (
                    <Badge tone={STATUS_TONE[row.status]} dot>
                      {row.status}
                    </Badge>
                  ),
                },
              ]}
              rows={SAMPLE_WALLETS}
              getRowKey={(row) => row.address}
            />
          </Card>
          <div style={{ marginTop: 'var(--ds-space-6)' }}>
            <StatGrid>
              <StatTile
                label="Total balance"
                value="0.0635 BTC"
                hint="across 3 wallets"
              />
              <StatTile label="Items held" value="5" tone="accent" />
              <StatTile label="Listed" value="3" tone="success" />
              <StatTile
                label="Pending"
                value="1"
                tone="danger"
                hint="waiting for confirmation"
              />
            </StatGrid>
          </div>
          <div style={{ marginTop: 'var(--ds-space-6)' }}>
            <Card padding="none">
              <EmptyState
                title="No proxy wallets yet"
                action={<Button size="sm">Create wallets</Button>}
              >
                Sign once with your connected wallet and Fine Trader derives
                your trading wallets.
              </EmptyState>
            </Card>
          </div>
        </Section>

        <Section
          title="Hand-drawn accents"
          description="Used sparingly: page titles, section breaks, one highlighted figure."
        >
          <div className={styles.stack}>
            <DoodleDivider />
            <p>
              Floor price is <Marker>0.0041 BTC</Marker> right now.
            </p>
          </div>
        </Section>

        <Section title="Type scale">
          {TYPE_SPECIMENS.map((specimen) => (
            <div key={specimen.label} className={styles.specimen}>
              <span className={styles.specimenMeta}>{specimen.label}</span>
              <span
                className={specimen.className || styles.sample}
                style={specimen.style}
              >
                {specimen.text}
              </span>
            </div>
          ))}
        </Section>

        <Section title="Color tokens">
          <div className={styles.stack}>
            <div className={styles.swatches}>
              {SURFACE_TOKENS.map((token) => (
                <div key={token} className={styles.swatch}>
                  <div
                    className={styles.swatchChip}
                    style={{ background: `var(${token})` }}
                  />
                  <div className={styles.swatchLabel}>{token}</div>
                </div>
              ))}
            </div>
            <div className={styles.swatches}>
              {STATE_TOKENS.map((token) => (
                <div key={token} className={styles.swatch}>
                  <div
                    className={styles.swatchChip}
                    style={{ background: `var(${token})` }}
                  />
                  <div className={styles.swatchLabel}>{token}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
};

export default DesignSystem;
