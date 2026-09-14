/**
 * Table: column-driven so every list in the app looks and behaves the same.
 * Below 720px each row collapses into a labelled card, so tables stay usable
 * on a phone.
 *
 * <Table
 *   columns={[
 *     { key: 'wallet', header: 'Wallet', render: (row) => row.label },
 *     { key: 'balance', header: 'Balance', align: 'right', numeric: true,
 *       render: (row) => formatSatsAsBtc(row.balance) },
 *   ]}
 *   rows={wallets}
 *   getRowKey={(row) => row.address}
 * />
 */
import React from 'react';
import styles from './Table.module.css';

/**
 * @typedef {object} Column
 * @property {string} key
 * @property {React.ReactNode} header
 * @property {(row: object, index: number) => React.ReactNode} render
 * @property {'left'|'right'|'center'} [align]
 * @property {boolean} [numeric] monospace, tabular figures
 * @property {string} [width] CSS width for the column
 */

/**
 * @param {object} props
 * @param {Column[]} props.columns
 * @param {object[]} props.rows
 * @param {(row: object, index: number) => string} props.getRowKey
 * @param {(row: object) => void} [props.onRowClick]
 * @param {(row: object) => boolean} [props.isRowSelected]
 * @param {React.ReactNode} [props.empty] shown when there are no rows
 */
const Table = ({
  columns,
  rows,
  getRowKey,
  onRowClick,
  isRowSelected,
  empty = null,
  className = '',
}) => {
  if (!rows.length && empty) return empty;

  const alignClass = (column) =>
    column.align === 'right'
      ? styles.right
      : column.align === 'center'
        ? styles.center
        : '';

  return (
    <div className={styles.wrapper}>
      <table
        className={[styles.table, onRowClick ? styles.clickable : '', className]
          .filter(Boolean)
          .join(' ')}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={alignClass(column)}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              className={isRowSelected?.(row) ? styles.selected : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-label={
                    typeof column.header === 'string'
                      ? column.header
                      : undefined
                  }
                  className={[
                    alignClass(column),
                    column.numeric ? styles.numeric : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Table;
