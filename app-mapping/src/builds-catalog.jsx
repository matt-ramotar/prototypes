import {LedgerLanding} from "./landing-ledger.jsx";

export function BuildsCatalog({navigate}) {
  return (
    <LedgerLanding
      title="Builds"
      navigate={navigate}
      onNavigate={({go, ...patch}) => {
        if (go) navigate({path: "/map", patch});
        else navigate({patch});
      }}
    />
  );
}
