import { Chain, Wallet } from '@ordzaar/ord-connect';
import leather_icon from '../../assets/images/svg/leather.svg';
import magic_icon from '../../assets/images/svg/magic_icon.svg';
import okx_icon from '../../assets/images/svg/okx.svg';
import unisat_icon from '../../assets/images/svg/unisat.svg';
import xverse_icon from '../../assets/images/svg/xverse-icon.svg';

/**
 * Browser wallets offered in the connect menus, in display order.
 * Connection logic per wallet lives in ./useConnect.ts.
 */
export const CONNECT_WALLET_LIST = [
  {
    wallet: Wallet.OKX,
    icon: okx_icon,
    order: 1,
    chains: [Chain.BITCOIN],
  },
  {
    wallet: Wallet.UNISAT,
    icon: unisat_icon,
    order: 2,
    chains: [Chain.BITCOIN, Chain.FRACTAL_BITCOIN],
  },
  {
    wallet: Wallet.XVERSE,
    icon: xverse_icon,
    order: 3,
    chains: [Chain.BITCOIN],
  },
  {
    wallet: Wallet.MAGICEDEN,
    icon: magic_icon,
    order: 4,
    chains: [Chain.BITCOIN],
  },
  {
    wallet: Wallet.LEATHER,
    icon: leather_icon,
    order: 5,
    chains: [Chain.BITCOIN],
  },
];
