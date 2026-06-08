import { Client, Wallet, xrpToDrops, type Payment } from "xrpl";

// ============================================================================
// XRPL Testnet Configuration
// ============================================================================
const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";
// Amount of XRP to send from account 1 -> 2.
// NOTE: the faucet funds ~100 XRP. An account must keep its base reserve
// (~1 XRP on testnet) plus the tx fee, so you cannot send the full balance.
const TRANSFER_AMOUNT_XRP = "25";

// ============================================================================
// Main: XRP Transfer Flow
// ============================================================================
async function main(): Promise<void> {
  const client = new Client(TESTNET_URL);

  try {
    // Step 1: Connect to testnet
    console.log("🔗 Connecting to XRPL Testnet...");
    await client.connect();
    console.log("✅ Connected");

    // Step 2: Generate AND fund 2 test accounts via built-in faucet.
    // client.fundWallet() with no argument creates a fresh wallet and funds it.
    console.log("\n💰 Creating and funding 2 test accounts via faucet...");
    const { wallet: wallet1, balance: balance1 } = await client.fundWallet();
    console.log(`✅ Account 1: ${wallet1.address} (${balance1} XRP)`);
    const { wallet: wallet2, balance: balance2 } = await client.fundWallet();
    console.log(`✅ Account 2: ${wallet2.address} (${balance2} XRP)`);

    // Step 3: Record balances BEFORE transfer
    console.log("\n📊 Balances before transfer:");
    const before1 = await client.getXrpBalance(wallet1.address);
    const before2 = await client.getXrpBalance(wallet2.address);
    console.log(`   Account 1: ${before1} XRP`);
    console.log(`   Account 2: ${before2} XRP`);

    // Step 4: Build the Payment transaction (XRPL fields are PascalCase).
    // Amount is given in drops (1 XRP = 1,000,000 drops) via xrpToDrops().
    const payment: Payment = {
      TransactionType: "Payment",
      Account: wallet1.address,
      Destination: wallet2.address,
      Amount: xrpToDrops(TRANSFER_AMOUNT_XRP),
    };

    // Step 5: Autofill — fills Fee, Sequence, LastLedgerSequence, etc.
    console.log("\n📝 Autofilling transaction...");
    const prepared = await client.autofill(payment);
    console.log(`   Fee: ${prepared.Fee} drops | Sequence: ${prepared.Sequence}`);

    // Step 6: Sign locally with the sender's wallet (private key never leaves here)
    const signed = wallet1.sign(prepared);
    console.log(`✅ Signed locally. Hash: ${signed.hash}`);

    // Step 7: Submit and wait for ledger validation
    console.log("\n⏳ Submitting and waiting for validation...");
    const result = await client.submitAndWait(signed.tx_blob);

    // Step 8: Validate the engine result is tesSUCCESS.
    // meta can be a string or object; guard before reading TransactionResult.
    const meta = result.result.meta;
    const txResult =
      typeof meta === "object" && meta !== null
        ? meta.TransactionResult
        : meta;

    console.log(`\n🔍 TransactionResult: ${txResult}`);
    if (txResult !== "tesSUCCESS") {
      throw new Error(`Transaction did not succeed: ${txResult}`);
    }
    console.log("✅ Transaction succeeded on-ledger");

    // Step 9: Record balances AFTER transfer to confirm the state changed
    console.log("\n📊 Balances after transfer:");
    const after1 = await client.getXrpBalance(wallet1.address);
    const after2 = await client.getXrpBalance(wallet2.address);
    console.log(`   Account 1: ${after1} XRP`);
    console.log(`   Account 2: ${after2} XRP`);

    // Step 10: Summary of the on-ledger changes
    console.log("\n📈 Summary:");
    console.log(
      `   Account 1: ${before1} -> ${after1} XRP ` +
      `(sent ${TRANSFER_AMOUNT_XRP} + fee)`
    );
    console.log(
      `   Account 2: ${before2} -> ${after2} XRP ` +
      `(received ${after2 - before2})`
    );
    console.log("\n🎉 Transfer complete and verified.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
    console.log("\n🔌 Disconnected from testnet");
  }
}

main();
