import { fetchJson } from "@ethersproject/web"
import BlocknativeSdk from "bnc-sdk"
import Emittery from "emittery"

import { EthereumTransactionData, BlockPrices } from "./types"
import { gweiToWei } from "../../lib/utils"

const BLOCKNATIVE_API_ROOT = "https://api.blocknative.com"

export const BlocknativeNetworkIds = {
  ethereum: {
    mainnet: 1,
  },
}

export type Events = {
  blockPrices: BlockPrices
}

// TODO Improve code to clearly discriminate between Bitcoin and
// TODO Ethereum---either top-level or inside the instance.

/**
 * The Blocknative class wraps access to the Blocknative API for the Tally
 * extension backend. It exposes Tally-specific functionality, and manages
 * connection and disconnection from Blocknative based on registered needs and
 * feedback from the Blocknative system to minimize usage when possible.
 */
export default class Blocknative {
  private blocknative: BlocknativeSdk

  private apiKey: string

  readonly emitter = new Emittery<Events>()

  static connect(apiKey: string, networkId: number): Blocknative {
    const connection = new this(apiKey, networkId)

    return connection
  }

  private constructor(apiKey: string, networkId: number) {
    // TODO Handle lazy connection, disconnects, resubscribing, rate limits,
    // TODO etc.
    this.blocknative = new BlocknativeSdk({
      dappId: apiKey,
      networkId,
    })

    this.apiKey = apiKey
  }

  watchBalanceUpdatesFor(
    accountAddress: string,
    handler: (
      transactionData: EthereumTransactionData,
      balanceDelta: bigint
    ) => void
  ): void {
    // TODO Centralize handling of txConfirmed.
    this.blocknative
      .account(accountAddress)
      .emitter.on("txConfirmed", (transactionData) => {
        if (
          "system" in transactionData &&
          transactionData.system === "ethereum" // not Bitcoin or a log
        ) {
          const transaction = transactionData as EthereumTransactionData

          const balanceDelta = transaction.netBalanceChanges
            ?.filter(({ address }) => address.toLowerCase() === accountAddress)
            .flatMap(({ balanceChanges }) => balanceChanges)
            .filter(({ asset: { type: assetType } }) => assetType === "ether")
            .reduce(
              (ethBalanceChangeDelta, { delta }) =>
                ethBalanceChangeDelta + BigInt(delta),
              0n
            )

          if (balanceDelta) {
            // Only if there is a balance delta to report.
            handler(transaction, balanceDelta)
          }
        }
      })
  }

  unwatchBalanceUpdatesFor(accountAddress: string): void {
    // TODO After centralizing handling, handle overall unsubscribing through
    // that mechanism.
    this.blocknative.account(accountAddress).emitter.off("txConfirmed")
    this.blocknative.unsubscribe(accountAddress)
  }

  /*
   * Helper function to get current block prices and estimated fees
   * Converts data from Blocknative into our own custom type
   */
  async getBlockPrices(): Promise<BlockPrices> {
    const request = {
      url: `${BLOCKNATIVE_API_ROOT}/gasprices/blockprices`,
      headers: { Authorization: this.apiKey },
    }

    // TODO: What happens if the blocknative API request fails or gets rate limited?
    const response = await fetchJson(request)
    const currentBlock = response.blockPrices[0]

    return {
      blockNumber: currentBlock.blockNumber,
      baseFeePerGas: gweiToWei(currentBlock.baseFeePerGas),
      estimatedTransactionCount: currentBlock.estimatedTransactionCount,
      estimatedPrices: currentBlock.estimatedPrices.map((estimate) => {
        return {
          confidence: estimate.confidence,
          price: gweiToWei(estimate.price),
          maxPriorityFeePerGas: gweiToWei(estimate.maxPriorityFeePerGas),
          maxFeePerGas: gweiToWei(estimate.maxFeePerGas),
        }
      }),
    }
  }

  /*
   * Periodically fetch block prices and emit an event whenever new data is received
   */
  async pollBlockPrices(): Promise<void> {
    // Immediately fetch the current block prices when this function gets called
    const blockPrices = await this.getBlockPrices()
    this.emitter.emit("blockPrices", blockPrices)

    // Set a timeout to continue fetching block prices, defaulting to every 120 seconds
    setTimeout(() => {
      this.pollBlockPrices()
    }, Number(process.env.BLOCKNATIVE_POLLING_FREQUENCY || 120) * 1000)
  }
}
