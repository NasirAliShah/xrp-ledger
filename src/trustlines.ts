import {
  Client,
  Wallet,
  type TrustSet,
  type Payment,
  type AccountSet,
  AccountSetAsfFlags,
} from "xrpl";

const TESTNET_URL = "wss://s.altnet.rippletest.net:51233";

// XRPL only supports 3-char native currency codes.
// 4-char names like USDC/EURC must be 20-byte hex (40 hex chars).
// Encoding: ASCII bytes of the name, zero-padded to 40 hex characters.
const USDC = "5553444300000000000000000000000000000000";
const EURC = "4555524300000000000000000000000000000000";

// Trust limit: how much of this currency the account is willing to hold.
const TRUST_LIMIT = "1000000";

// How much the gateway "issues" to wallet1 in this demo.
const ISSUE_USDC = "500";
const ISSUE_EURC = "200";

function validateTxResult(meta: unknown, label: string): void {
  const txResult =
    typeof meta === "object" && meta !== null
      ? (meta as { TransactionResult: string }).TransactionResult
      : meta;
  if (txResult !== "tesSUCCESS") {
    throw new Error(`${label} failed: ${txResult}`);
  }
  console.log(`✅ ${label}: tesSUCCESS`);
}

async function main(): Promise<void> {
  const client = new Client(TESTNET_URL);

  try {
    console.log("🔗 Connecting to XRPL Testnet...");
    await client.connect();
    console.log("✅ Connected\n");

    // Step 1: Create 3 accounts — gateway (issuer), wallet1 (holder), wallet2 (holder).
    // NOTE: on XRPL testnet there is no official USDC/EURC issuer.
    // We create our own gateway wallet to simulate real issuer mechanics.
    console.log("💰 Creating and funding 3 accounts via faucet...");
    const { wallet: gateway } = await client.fundWallet();
    const { wallet: wallet1 } = await client.fundWallet();
    const { wallet: wallet2 } = await client.fundWallet();
    console.log(`   Gateway (issuer): ${gateway.address}`);
    console.log(`   Wallet 1 (holder): ${wallet1.address}`);
    console.log(`   Wallet 2 (holder): ${wallet2.address}\n`);

    // Step 2: Gateway enables asfDefaultRipple.
    // This flag allows balances issued by the gateway to "ripple" (be transferred)
    // between accounts that hold the same currency. Required for IOU payments.
    console.log("⚙️  Enabling DefaultRipple on gateway...");
    const accountSetTx: AccountSet = {
      TransactionType: "AccountSet",
      Account: gateway.address,
      SetFlag: AccountSetAsfFlags.asfDefaultRipple,
    };
    const filledAccountSet = await client.autofill(accountSetTx);
    const signedAccountSet = gateway.sign(filledAccountSet);
    const accountSetResult = await client.submitAndWait(signedAccountSet.tx_blob);
    validateTxResult(accountSetResult.result.meta, "Gateway DefaultRipple");

    // Step 3: Wallet1 sets a trustline to gateway for USDC.
    // A trustline is mandatory — you cannot receive an IOU without one.
    // The LimitAmount defines the max you're willing to hold from this issuer.
    console.log("\n🔗 Setting trustlines...");
    const trustUSDC_W1: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet1.address,
      LimitAmount: {
        currency: USDC,
        issuer: gateway.address,
        value: TRUST_LIMIT,
      },
    };
    const filledTrustUSDC_W1 = await client.autofill(trustUSDC_W1);
    const signedTrustUSDC_W1 = wallet1.sign(filledTrustUSDC_W1);
    const r1 = await client.submitAndWait(signedTrustUSDC_W1.tx_blob);
    validateTxResult(r1.result.meta, "Wallet1 TrustSet USDC");

    // Step 4: Wallet1 sets a trustline to gateway for EURC.
    const trustEURC_W1: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet1.address,
      LimitAmount: {
        currency: EURC,
        issuer: gateway.address,
        value: TRUST_LIMIT,
      },
    };
    const filledTrustEURC_W1 = await client.autofill(trustEURC_W1);
    const signedTrustEURC_W1 = wallet1.sign(filledTrustEURC_W1);
    const r2 = await client.submitAndWait(signedTrustEURC_W1.tx_blob);
    validateTxResult(r2.result.meta, "Wallet1 TrustSet EURC");

    // Step 5: Wallet2 sets trustlines for USDC and EURC.
    const trustUSDC_W2: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet2.address,
      LimitAmount: {
        currency: USDC,
        issuer: gateway.address,
        value: TRUST_LIMIT,
      },
    };
    const filledTrustUSDC_W2 = await client.autofill(trustUSDC_W2);
    const signedTrustUSDC_W2 = wallet2.sign(filledTrustUSDC_W2);
    const r3 = await client.submitAndWait(signedTrustUSDC_W2.tx_blob);
    validateTxResult(r3.result.meta, "Wallet2 TrustSet USDC");

    const trustEURC_W2: TrustSet = {
      TransactionType: "TrustSet",
      Account: wallet2.address,
      LimitAmount: {
        currency: EURC,
        issuer: gateway.address,
        value: TRUST_LIMIT,
      },
    };
    const filledTrustEURC_W2 = await client.autofill(trustEURC_W2);
    const signedTrustEURC_W2 = wallet2.sign(filledTrustEURC_W2);
    const r4 = await client.submitAndWait(signedTrustEURC_W2.tx_blob);
    validateTxResult(r4.result.meta, "Wallet2 TrustSet EURC");

    // Step 6: Gateway issues USDC and EURC to wallet1 via Payment.
    // The gateway sends from itself — this is how tokens are created on XRPL.
    // No currency leaves the ledger; the gateway's obligation increases.
    console.log("\n💸 Gateway issuing USDC to Wallet1...");
    const issueUSDC: Payment = {
      TransactionType: "Payment",
      Account: gateway.address,
      Destination: wallet1.address,
      Amount: {
        currency: USDC,
        issuer: gateway.address,
        value: ISSUE_USDC,
      },
    };
    const filledIssueUSDC = await client.autofill(issueUSDC);
    const signedIssueUSDC = gateway.sign(filledIssueUSDC);
    const r5 = await client.submitAndWait(signedIssueUSDC.tx_blob);
    validateTxResult(r5.result.meta, `Issue ${ISSUE_USDC} USDC to Wallet1`);

    console.log("💸 Gateway issuing EURC to Wallet1...");
    const issueEURC: Payment = {
      TransactionType: "Payment",
      Account: gateway.address,
      Destination: wallet1.address,
      Amount: {
        currency: EURC,
        issuer: gateway.address,
        value: ISSUE_EURC,
      },
    };
    const filledIssueEURC = await client.autofill(issueEURC);
    const signedIssueEURC = gateway.sign(filledIssueEURC);
    const r6 = await client.submitAndWait(signedIssueEURC.tx_blob);
    validateTxResult(r6.result.meta, `Issue ${ISSUE_EURC} EURC to Wallet1`);

    // Step 7: Wallet1 sends 100 USDC to Wallet2 (peer-to-peer IOU transfer).
    console.log("\n📤 Wallet1 sending 100 USDC to Wallet2...");
    const sendUSDC: Payment = {
      TransactionType: "Payment",
      Account: wallet1.address,
      Destination: wallet2.address,
      Amount: {
        currency: USDC,
        issuer: gateway.address,
        value: "100",
      },
    };
    const filledSendUSDC = await client.autofill(sendUSDC);
    const signedSendUSDC = wallet1.sign(filledSendUSDC);
    const r7 = await client.submitAndWait(signedSendUSDC.tx_blob);
    validateTxResult(r7.result.meta, "Wallet1 -> Wallet2: 100 USDC");

    // Step 8: Check final IOU balances via account_lines.
    console.log("\n📊 Final IOU balances (account_lines):");
    const lines1 = await client.request({
      command: "account_lines",
      account: wallet1.address,
      ledger_index: "validated",
    });
    const lines2 = await client.request({
      command: "account_lines",
      account: wallet2.address,
      ledger_index: "validated",
    });

    console.log("   Wallet1 trustlines:");
    for (const line of lines1.result.lines) {
      console.log(`     ${line.currency}: ${line.balance} (limit: ${line.limit})`);
    }
    console.log("   Wallet2 trustlines:");
    for (const line of lines2.result.lines) {
      console.log(`     ${line.currency}: ${line.balance} (limit: ${line.limit})`);
    }

    console.log("\n🎉 Trustline setup and IOU transfer complete.");
  } catch (error) {
    console.error("\n❌ Error:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await client.disconnect();
    console.log("🔌 Disconnected");
  }
}

main();
