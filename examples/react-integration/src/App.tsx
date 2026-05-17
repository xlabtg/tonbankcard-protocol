import { useMemo, useState } from 'react';
import { Address } from '@ton/core';
import {
  TonbankcardSDK,
  TESTNET_CONFIG,
  parseTBC,
  formatTBC,
  shortAddress,
  type Invoice,
} from '@tonbankcard/merchant-sdk';
import { TonbankcardCheckout } from './TonbankcardCheckout';

// Configuration is sourced from import.meta.env so that no secrets land in the
// repository. See .env.example for the list of variables.
const MERCHANT_NFT_ADDRESS = import.meta.env.VITE_MERCHANT_NFT as string;
const PAYMENT_HUB_ADDRESS = (import.meta.env.VITE_PAYMENT_HUB as string | undefined) ?? '';
const RPC_ENDPOINT = import.meta.env.VITE_RPC_ENDPOINT as string | undefined;

export function App() {
  const [orderId, setOrderId] = useState('ORDER-' + Date.now().toString(36).toUpperCase());
  const [amountTbc, setAmountTbc] = useState('1.50');
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentCompleteHash, setPaymentCompleteHash] = useState<string | null>(null);

  // The SDK reads the blockchain only; constructing it client-side is safe
  // because it never holds keys or secrets.
  const sdk = useMemo(() => {
    if (!MERCHANT_NFT_ADDRESS) return null;
    try {
      return new TonbankcardSDK({
        ...TESTNET_CONFIG,
        paymentHubAddress: PAYMENT_HUB_ADDRESS
          ? Address.parse(PAYMENT_HUB_ADDRESS)
          : Address.parse(MERCHANT_NFT_ADDRESS),
        rpcEndpoint: RPC_ENDPOINT,
      });
    } catch (e) {
      setError((e as Error).message);
      return null;
    }
  }, []);

  const handleCreateInvoice = () => {
    setError(null);
    setPaymentCompleteHash(null);
    if (!sdk) {
      setError('SDK not initialised. Check VITE_MERCHANT_NFT in .env.local.');
      return;
    }
    try {
      const next = sdk.createInvoice({
        merchantNft: Address.parse(MERCHANT_NFT_ADDRESS),
        amountTbc: parseTBC(amountTbc),
        orderId,
        description: `React demo order ${orderId}`,
        expirationSeconds: 60 * 60,
      });
      setInvoice(next);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>TONBANKCARD React example</h1>
        <p style={styles.subtitle}>
          Non-custodial checkout against TON testnet using
          <code style={styles.code}> @tonbankcard/merchant-sdk</code>.
        </p>
      </header>

      <section style={styles.card}>
        <h2 style={styles.h2}>1. Configure the order</h2>

        <label style={styles.label}>
          Order ID
          <input
            style={styles.input}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
          />
        </label>

        <label style={styles.label}>
          Amount (TBC)
          <input
            style={styles.input}
            value={amountTbc}
            onChange={(e) => setAmountTbc(e.target.value)}
            inputMode="decimal"
          />
        </label>

        <button style={styles.primaryBtn} onClick={handleCreateInvoice}>
          Create invoice
        </button>

        {error && <p style={styles.error}>{error}</p>}

        {MERCHANT_NFT_ADDRESS && (
          <p style={styles.meta}>
            Merchant NFT: <code>{shortAddress(MERCHANT_NFT_ADDRESS)}</code>
          </p>
        )}
      </section>

      {invoice && (
        <section style={styles.card}>
          <h2 style={styles.h2}>2. Pay with a TON wallet</h2>
          <p style={styles.meta}>
            Invoice <code>{invoice.id.slice(0, 12)}…</code> ·{' '}
            <strong>{formatTBC(invoice.amountTbc)} TBC</strong>
          </p>

          <TonbankcardCheckout
            invoice={invoice}
            onPaymentComplete={(txHash) => setPaymentCompleteHash(txHash)}
          />

          {paymentCompleteHash && (
            <p style={styles.success}>
              Payment reported by wallet: <code>{paymentCompleteHash}</code>.
              <br />
              Verify it on-chain before granting access to the customer.
            </p>
          )}
        </section>
      )}

      <footer style={styles.footer}>
        <p>
          <strong>Trust model:</strong> the SDK is informational. Always verify
          the on-chain settlement event before delivering goods.
        </p>
      </footer>
    </main>
  );
}

const styles = {
  page: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    maxWidth: 640,
    margin: '0 auto',
    padding: '32px 16px 64px',
    color: '#1a1a1a',
  },
  header: { marginBottom: 24 },
  title: { margin: 0, fontSize: 28 },
  subtitle: { color: '#555', lineHeight: 1.5 },
  code: { background: '#f1f3f5', padding: '2px 6px', borderRadius: 4 },
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    background: '#fff',
  },
  h2: { marginTop: 0, fontSize: 18 },
  label: { display: 'block', marginBottom: 12, fontSize: 14, color: '#333' },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: '8px 10px',
    fontSize: 14,
    border: '1px solid #ccd0d5',
    borderRadius: 8,
    boxSizing: 'border-box' as const,
  },
  primaryBtn: {
    background: '#0088cc',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 16px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  meta: { fontSize: 13, color: '#555', marginTop: 12 },
  error: { color: '#c0392b', marginTop: 12 },
  success: { color: '#1d7a3a', marginTop: 12, wordBreak: 'break-all' as const },
  footer: { fontSize: 12, color: '#666', lineHeight: 1.5 },
} satisfies Record<string, React.CSSProperties>;
