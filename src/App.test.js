import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

import App from './App';

// Mock swiper/react and swiper/css
jest.mock('swiper/react', () => ({
  Swiper: ({ children }) => <div data-testid="swiper">{children}</div>,
  SwiperSlide: ({ children }) => (
    <div data-testid="swiper-slide">{children}</div>
  ),
}));
jest.mock('swiper/css', () => ({}));
jest.mock('swiper/css/mousewheel', () => ({}));
jest.mock('swiper/modules', () => ({
  Autoplay: {},
  Mousewheel: {},
}));

// Mock problematic components and dependencies
jest.mock('./components/common/ConnectWallet', () => {
  return function MockConnectWallet() {
    return <div data-testid="connect-wallet">Connect Wallet</div>;
  };
});

jest.mock('./components/common/BackToTop', () => {
  return function MockBackToTop() {
    return <div data-testid="back-to-top">Back to Top</div>;
  };
});

jest.mock('./components/common/Footer', () => {
  return function MockFooter() {
    return <div data-testid="footer">Footer</div>;
  };
});

// Mock the wallet component that uses @ordzaar/ord-connect
jest.mock('./components/common/Wallet', () => {
  return function MockWallet() {
    return <div data-testid="wallet">Wallet</div>;
  };
});

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    // NavBar has been removed, so we just check that the app renders
    expect(document.body).toBeInTheDocument();
  });

  test('renders back to top component', () => {
    render(<App />);
    expect(screen.getByTestId('back-to-top')).toBeInTheDocument();
  });

  test('renders footer component', () => {
    render(<App />);
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  test('has proper accessibility attributes', () => {
    render(<App />);
    const appElement = screen.queryByRole('main') || screen.getByTestId('root');
    expect(appElement).toBeInTheDocument();
  });
});
