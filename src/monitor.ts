import { Client, Wallet, xrpToDrops, type TransactionStream, type Payment } from "xrpl";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

// How long to listen for incoming transactions before stopping (ms).
const MONITOR_DURATION_MS = 30_000;

async function main(): Promise<void> {
  const client = new Client(TESTNET_URL);

  try {
    console.log("🔗 Connecting to XRPL Testnet...");
    await client.connect();
    console.log("✅ Connected\n");

    // Step 1: Create 2 accounts — sender and receiver.
    console.log("💰 Creating and funding 2 accounts via faucet...");
    const { wallet: sender } = await client.fundWallet();
    const { wallet: receiver } = await client.fundWallet();
    console.log(`   Sender:   ${sender.address}`);
    console.log(`   Receiver: ${receiver.address}\n`);

    // Step 2: Subscribe to the receiver's account on the transaction stream.
    // The XRPL server will push a TransactionStream event over the WebSocket
    // every time a validated transaction touches this account.
    console.log(`👂 Subscribing to incoming transactions for receiver...`);
    await client.request({
      command: "subscribe",
      accounts: [receiver.address],
    });

    let txCount = 0;

    // Step 3: Register event listener on the client.
    // 'transaction' fires for every validated tx affecting subscribed accounts.
    client.on("transaction", (tx: TransactionStream) => {
      txCount++;
      const txJson = tx.tx_json as Payment | undefined;
      const type = txJson?.TransactionType ?? "Unknown";
      const from = txJson?.Account ?? "Unknown";

      console.log(`\n📨 Incoming transaction #${txCount} detected!`);
      console.log(`   Type:   ${type}`);
      console.log(`   From:   ${from}`);
      console.log(`   Result: ${tx.engine_result}`);

      if (
        type === "Payment" &&
        typeof txJson?.Amount === "string"
      ) {
        // Amount is a string of drops for native XRP payments.
        const xrp = (Number(txJson.Amount) / 1_000_000).toFixed(6);
        console.log(`   Amount: ${xrp} XRP`);
      } else if (
        type === "Payment" &&
        typeof txJson?.Amount === "object" &&
        txJson?.Amount !== null
      ) {
        // Amount is an IssuedCurrencyAmount for IOU payments.
        const iou = txJson.Amount as { currency: string; value: string };
        console.log(`   Amount: ${iou.value} ${iou.currency}`);
      }

      // In API v2 (default), the hash is a top-level field on TransactionStream.
      console.log(`   Hash:   ${tx.hash ?? "N/A"}`);
    });

    // Step 4: Send 3 staggered payments from sender to receiver so we
    // can observe the monitor picking them up in real time.
    console.log(`⏳ Monitoring for ${MONITOR_DURATION_MS / 1000}s — sending test payments...\n`);

    const amounts = ["10", "20", "5"];
    for (const amount of amounts) {
      const payment: Payment = {
        TransactionType: "Payment",
        Account: sender.address,
        Destination: receiver.address,
        Amount: xrpToDrops(amount),
      };
      const prepared = await client.autofill(payment);
      const signed = sender.sign(prepared);
      // Use submit (not submitAndWait) so the monitor fires the event.
      await client.submit(signed.tx_blob);
      console.log(`📤 Submitted payment of ${amount} XRP (not yet validated)`);
      // Wait 5s between payments so each appears as a distinct event.
      await new Promise((r) => setTimeout(r, 5_000));
    }

    // Step 5: Wait remaining time for any last events then unsubscribe.
    await new Promise((r) => setTimeout(r, 5_000));

    console.log(`\n🛑 Unsubscribing from account stream...`);
    await client.request({
      command: "unsubscribe",
      accounts: [receiver.address],
    });

    console.log(`\n📊 Summary: caught ${txCount} validated transaction(s).`);
    console.log("🎉 Monitor demo complete.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
    console.log("🔌 Disconnected");
  }
}

main();
