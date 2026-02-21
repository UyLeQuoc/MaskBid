"use client";

import { useState, useCallback } from "react";
import { BrowserProvider, Contract, JsonRpcSigner, ethers } from "ethers";
import { MaskBidAuctionABI } from "@/abis/MaskBidAuction";
import { env } from "@/configs/env";

export type AuctionState = 0 | 1 | 2 | 3 | 4; // Created, Active, Ended, Finalized, Cancelled

export interface Auction {
  tokenId: bigint;
  tokenAmount: bigint;
  seller: string;
  reservePrice: bigint;
  depositRequired: bigint;
  startTime: bigint;
  endTime: bigint;
  state: AuctionState;
  winner: string;
  winningBid: bigint;
  bidCount: bigint;
}

export interface Bid {
  bidder: string;
  bidHash: string;
  escrowAmount: bigint;
  refunded: boolean;
}

export function useMaskBidAuction() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback(async (withSigner = false) => {
    const address = env.NEXT_PUBLIC_AUCTION_CONTRACT_ADDRESS;
    if (!address) {
      throw new Error("Auction contract address not configured");
    }

    if (withSigner) {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("MetaMask not installed");
      }
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      return new Contract(address, MaskBidAuctionABI, signer);
    } else {
      const provider = new ethers.JsonRpcProvider(env.NEXT_PUBLIC_RPC_URL);
      return new Contract(address, MaskBidAuctionABI, provider);
    }
  }, []);

  const getAuction = useCallback(async (auctionId: bigint): Promise<Auction | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(false);
      const auction = await contract.getAuction(auctionId);
      return auction as Auction;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const getAuctionState = useCallback(async (auctionId: bigint): Promise<AuctionState | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(false);
      const state = await contract.getAuctionState(auctionId);
      return Number(state) as AuctionState;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const getBid = useCallback(async (auctionId: bigint, bidIndex: bigint): Promise<Bid | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(false);
      const bid = await contract.getBid(auctionId, bidIndex);
      return bid as Bid;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const hasBid = useCallback(async (auctionId: bigint, bidder: string): Promise<boolean> => {
    try {
      const contract = await getContract(false);
      return await contract.hasBid(auctionId, bidder);
    } catch {
      return false;
    }
  }, [getContract]);

  const createAuction = useCallback(async (
    tokenId: bigint,
    tokenAmount: bigint,
    reservePrice: bigint,
    depositRequired: bigint,
    startTime: bigint,
    endTime: bigint
  ): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(true);
      const tx = await contract.createAuction(
        tokenId,
        tokenAmount,
        reservePrice,
        depositRequired,
        startTime,
        endTime
      );
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const placeBid = useCallback(async (
    auctionId: bigint,
    bidHash: string
  ): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(true);
      const tx = await contract.placeBid(auctionId, bidHash);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const endAuction = useCallback(async (auctionId: bigint): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(true);
      const tx = await contract.endAuction(auctionId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const claimRefund = useCallback(async (auctionId: bigint): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(true);
      const tx = await contract.claimRefund(auctionId);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const getNextAuctionId = useCallback(async (): Promise<bigint | null> => {
    try {
      const contract = await getContract(false);
      return await contract.getNextAuctionId();
    } catch {
      return null;
    }
  }, [getContract]);

  return {
    loading,
    error,
    getAuction,
    getAuctionState,
    getBid,
    hasBid,
    createAuction,
    placeBid,
    endAuction,
    claimRefund,
    getNextAuctionId,
  };
}
