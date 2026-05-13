import PageMeta from "../../components/common/PageMeta";
import LiveOptionChain from "../../components/common/LiveOptionChain";

export default function LiveOptionChainPage() {
  return (
    <>
      <PageMeta
        title="Live Option Chain"
        description="Live option chain with Black-Scholes Greeks"
      />
      <LiveOptionChain />
    </>
  );
}
