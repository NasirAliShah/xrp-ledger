import { Client, xrpToDrops, type Payment, type Transaction } from "xrpl";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

// Number of transactions to fetch per page from account_tx.
const PAGE_LIMIT = 20;

function formatAmount(amount: Payment["Amount"]): string {
  if (typeof amount === "string") {
    return `${(Number(amount) / 1_000_000).toFixed(6)} XRP`;
  }
  // "currency" in amount narrows from (IssuedCurrencyAmount | MPTAmount) to IssuedCurrencyAmount.
  if (typeof amount === "object" && amount !== null && "currency" in amount) {
    return `${amount.value} ${amount.currency}`;
  }
  return "Unknown";
}

function printTx(tx: Transaction & { hash?: string }, index: number, validated: boolean): void {
  console.log(`\n  [${index + 1}] Type: ${tx.TransactionType}`);
  console.log(`      Hash:  ${tx.hash ?? "N/A"}`);
  console.log(`      From:  ${tx.Account}`);
  if (tx.TransactionType === "Payment") {
    const p = tx as Payment;
    // API v2 renames Amount → DeliverMax in responses. Fall back to Amount for safety.
    const displayAmount = p.DeliverMax ?? p.Amount;
    console.log(`      To:    ${p.Destination}`);
    console.log(`      Amount: ${formatAmount(displayAmount)}`);
  }
  console.log(`      Fee:   ${Number(tx.Fee) / 1_000_000} XRP`);
  console.log(`      Validated: ${validated}`);
}

async function main(): Promise<void> {
  const client = new Client(TESTNET_URL);

  try {
    console.log("🔗 Connecting to XRPL Testnet...");
    await client.connect();
    console.log("✅ Connected\n");

    // Step 1: Create and fund an account, then generate some history.
    console.log("💰 Creating and funding 2 accounts via faucet...");
    const { wallet: wallet1 } = await client.fundWallet();
    const { wallet: wallet2 } = await client.fundWallet();
    console.log(`   Wallet1: ${wallet1.address}`);
    console.log(`   Wallet2: ${wallet2.address}\n`);

    // Step 2: Send a few payments to build transaction history.
    console.log("📤 Sending 3 payments to build history...");
    const testAmounts = ["10", "15", "5"];
    for (const amount of testAmounts) {
      const payment: Payment = {
        TransactionType: "Payment",
        Account: wallet1.address,
        Destination: wallet2.address,
        Amount: xrpToDrops(amount),
      };
      const prepared = await client.autofill(payment);
      const signed = wallet1.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);
      const meta = result.result.meta;
      const txResult =
        typeof meta === "object" && meta !== null
          ? meta.TransactionResult
          : meta;
      console.log(`   Sent ${amount} XRP → ${txResult}`);
    }

    // Step 3: Fetch transaction history using account_tx.
    // DEFAULT_API_VERSION is 2, so transactions are in tx_json + hash fields.
    // forward: false means newest first (default).
    // limit: controls page size; use marker for pagination.
    console.log(`\n📜 Fetching transaction history for Wallet1 (limit: ${PAGE_LIMIT})...`);
    const historyResponse = await client.request({
      command: "account_tx",
      account: wallet1.address,
      limit: PAGE_LIMIT,
      ledger_index_min: -1,  // -1 = earliest available ledger
      ledger_index_max: -1,  // -1 = latest validated ledger
    });

    const transactions = historyResponse.result.transactions;
    console.log(`\n✅ Found ${transactions.length} transaction(s):\n`);

    for (let i = 0; i < transactions.length; i++) {
      const entry = transactions[i];
      // API v2: tx is in tx_json, hash is a top-level field
      if (entry.tx_json) {
        const txWithHash = { ...entry.tx_json, hash: entry.hash };
        printTx(txWithHash as Transaction & { hash?: string }, i, entry.validated);
      }
    }

    // Step 4: Show pagination — if there are more pages, print the marker.
    if (historyResponse.result.marker) {
      console.log(`\n⚠️  More transactions available. Use marker to paginate:`);
      console.log(`   marker: ${JSON.stringify(historyResponse.result.marker)}`);
    } else {
      console.log("\n✅ All transactions fetched (no more pages).");
    }

    console.log("\n🎉 Transaction history complete.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
    console.log("🔌 Disconnected");
  }
}

main();
