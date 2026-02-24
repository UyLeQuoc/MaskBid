"use client";

import { useState, useCallback } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import { USDCABI } from "@/abis/USDC";
import { env } from "@/configs/env";

export function useUSDC() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getContract = useCallback(async (withSigner = false) => {
    const address = env.NEXT_PUBLIC_USDC_ADDRESS;

    if (withSigner) {
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("MetaMask not installed");
      }
      const provider = new BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      return new Contract(address, USDCABI, signer);
    } else {
      const provider = new ethers.JsonRpcProvider(env.NEXT_PUBLIC_RPC_URL);
      return new Contract(address, USDCABI, provider);
    }
  }, []);

  const getBalance = useCallback(async (address: string): Promise<bigint | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(false);
      return await contract.balanceOf(address);
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const getAllowance = useCallback(async (owner: string, spender: string): Promise<bigint | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(false);
      return await contract.allowance(owner, spender);
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const approve = useCallback(async (spender: string, amount: bigint): Promise<string | null> => {
    try {
      setLoading(true);
      setError(null);
      const contract = await getContract(true);
      const tx = await contract.approve(spender, amount);
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err) {
      setError((err as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getContract]);

  const formatUSDC = useCallback((amount: bigint): string => {
    // USDC has 6 decimals
    return ethers.formatUnits(amount, 6);
  }, []);

  const parseUSDC = useCallback((amount: string): bigint => {
    // USDC has 6 decimals
    return ethers.parseUnits(amount, 6);
  }, []);

  return {
    loading,
    error,
    getBalance,
    getAllowance,
    approve,
    formatUSDC,
    parseUSDC,
  };
}
