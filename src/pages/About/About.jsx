/**
 * About: what Fine Trader is, and what it does not promise.
 *
 * The risk notice is the reason this page exists, so it leads rather than
 * sitting at the bottom where nobody scrolls. Everything here is plain
 * statement of fact — this software moves real money on a chain with no
 * undo, and the person reading deserves to know that before they fund a
 * wallet, not after.
 */
import React from 'react';
import { Alert, Card, DoodleDivider, Page, PageHeader } from '../../ui';
import styles from './About.module.css';

const WHAT_IT_DOES = [
  {
    title: 'Auto-trading',
    body: 'Runs a strategy over a collection on Satflow or ord.net — buying at the floor and relisting, trading a range, or making a single pass and stopping.',
  },
  {
    title: 'Fine Trader wallets',
    body: 'Throwaway wallets derived from one signature by your own wallet. The trader holds their keys, so it can sign each trade itself instead of asking you to approve every one mid-run.',
  },
  {
    title: 'Consolidator',
    body: 'Sweeps the funds sitting across those wallets back into a single address.',
  },
  {
    title: 'Extractor',
    body: 'Moves inscriptions into their own outputs so they can be sent somewhere safe.',
  },
];

const About = () => (
  <Page variant="market">
    <PageHeader
      title="About Fine Trader"
      description="An auto-trader for Bitcoin ordinals."
    />

    {/*
      First, not last. Someone deciding whether to fund a wallet needs this
      before the feature list, not after it.
    */}
    <Alert tone="warning" title="Beta software — read this first">
      <p className={styles.copy}>
        Fine Trader is beta software and will have bugs. It signs and broadcasts
        real Bitcoin transactions, and a broadcast transaction cannot be undone
        or reversed by anyone.
      </p>
      <p className={styles.copy}>
        <strong>
          You use it entirely at your own risk. The developer accepts no
          responsibility or liability for any loss of funds
        </strong>{' '}
        — whether caused by a bug in this software, a mistake in how it is used,
        a failure or change at a marketplace or API it depends on, a wallet or
        browser extension, or anything else.
      </p>
      <p className={styles.copy}>
        Nothing here is financial advice. Trade only what you can afford to lose
        outright, and start with an amount small enough that losing it would not
        matter.
      </p>
    </Alert>

    <Card title="What it does">
      <div className={styles.grid}>
        {WHAT_IT_DOES.map((entry) => (
          <div key={entry.title}>
            <h3 className={styles.itemTitle}>{entry.title}</h3>
            <p className={styles.copy}>{entry.body}</p>
          </div>
        ))}
      </div>
    </Card>

    <Card title="How your keys are handled">
      <div className={styles.stack}>
        <p className={styles.copy}>
          Fine Trader runs entirely in your browser. Your connected wallet signs
          a message once; the Fine Trader wallets are derived from that
          signature and their keys stay on your machine. They are never sent
          anywhere.
        </p>
        <DoodleDivider />
        <p className={styles.copy}>
          Because the same signature always derives the same wallets, nothing is
          lost if you clear your browser: reconnect, sign again, and the wallets
          and their funds come back. By the same token, anyone who obtains that
          signature can derive your wallets — treat it as you would a seed
          phrase.
        </p>
        <p className={styles.copy}>
          Funds left in Fine Trader wallets are only as safe as the device they
          were derived on. Sweep them back with the Consolidator when a run is
          finished.
        </p>
      </div>
    </Card>

    <Card title="What it depends on">
      <div className={styles.stack}>
        <p className={styles.copy}>
          Trading runs against the Satflow and ord.net marketplaces, with chain
          data from mempool.space or Blockstream and inscription data from
          UniSat. Fine Trader does not control any of them. If one changes,
          rate-limits, or goes down, runs can fail part-way through — including
          after a purchase has been paid for but before it settles.
        </p>
        <p className={styles.copy}>
          ord.net will not sign a wallet in unless it holds a minimum confirmed
          balance. Wallets under it are skipped, and the activity log says
          which.
        </p>
      </div>
    </Card>
  </Page>
);

export default About;
