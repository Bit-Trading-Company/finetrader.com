/**
 * PSBT Validation Utility
 *
 * This utility helps validate and compare PSBTs to ensure they're properly formatted
 * for Magic Eden's API.
 */

import * as bitcoin from 'bitcoinjs-lib';

/**
 * Validate a signed PSBT for Magic Eden listing
 * @param {string} psbtBase64 - The signed PSBT in base64 format
 * @param {string} expectedAddress - The expected Taproot address
 * @returns {Object} Validation result with details
 */
export const validateSignedPsbt = (psbtBase64) => {
  const result = {
    valid: false,
    errors: [],
    warnings: [],
    details: {},
  };

  try {
    // Parse PSBT
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    result.details.inputCount = psbt.inputCount;
    result.details.outputCount = psbt.data.outputs.length;

    if (psbt.inputCount === 0) {
      result.errors.push('PSBT has no inputs');
      return result;
    }

    // Check first input (the one we signed)
    const input0 = psbt.data.inputs[0];
    result.details.input0Fields = Object.keys(input0);

    // Check for Taproot signature
    if (input0.tapKeySig) {
      result.details.hasTapKeySig = true;
      result.details.tapKeySigLength = input0.tapKeySig.length;

      if (input0.tapKeySig.length !== 64) {
        result.errors.push(
          `Taproot signature should be 64 bytes, got ${input0.tapKeySig.length}`
        );
      }
    } else {
      result.details.hasTapKeySig = false;
      result.warnings.push('No tapKeySig found (expected for Taproot)');
    }

    // Check for ECDSA signature (shouldn't be present for Taproot)
    if (input0.partialSig) {
      result.details.hasPartialSig = true;
      result.warnings.push(
        'partialSig found (this is for SegWit, not Taproot)'
      );
    } else {
      result.details.hasPartialSig = false;
    }

    // Check for tapInternalKey
    if (input0.tapInternalKey) {
      result.details.hasTapInternalKey = true;
      result.details.tapInternalKeyLength = input0.tapInternalKey.length;

      if (input0.tapInternalKey.length !== 32) {
        result.errors.push(
          `tapInternalKey should be 32 bytes, got ${input0.tapInternalKey.length}`
        );
      }
    } else {
      result.details.hasTapInternalKey = false;
      result.errors.push('Missing tapInternalKey (required for Taproot)');
    }

    // Check witnessUtxo
    if (input0.witnessUtxo) {
      result.details.hasWitnessUtxo = true;
      result.details.witnessUtxoValue = input0.witnessUtxo.value;
    } else {
      result.details.hasWitnessUtxo = false;
      result.errors.push('Missing witnessUtxo (required)');
    }

    // Check sighashType
    result.details.sighashType = input0.sighashType;
    if (input0.sighashType !== 129 && input0.sighashType !== 131) {
      result.warnings.push(
        `Unusual sighashType: ${input0.sighashType} (expected 129 or 131)`
      );
    }

    // Check if PSBT is finalized (it shouldn't be for listings)
    if (input0.finalScriptWitness || input0.finalScriptSig) {
      result.errors.push(
        'PSBT appears to be finalized (should not be finalized for listings)'
      );
      result.details.isFinalized = true;
    } else {
      result.details.isFinalized = false;
    }

    // Determine if valid
    result.valid = result.errors.length === 0;

    return result;
  } catch (err) {
    result.errors.push(`Failed to parse PSBT: ${err.message}`);
    return result;
  }
};

/**
 * Compare two PSBTs and show differences
 * @param {string} psbt1Base64 - First PSBT
 * @param {string} psbt2Base64 - Second PSBT
 * @param {string} label1 - Label for first PSBT
 * @param {string} label2 - Label for second PSBT
 */
export const comparePsbts = (psbt1Base64, psbt2Base64, label1, label2) => {
  console.log(`\n═══ Comparing ${label1} vs ${label2} ═══`);

  try {
    const psbt1 = bitcoin.Psbt.fromBase64(psbt1Base64);
    const psbt2 = bitcoin.Psbt.fromBase64(psbt2Base64);

    const input1 = psbt1.data.inputs[0];
    const input2 = psbt2.data.inputs[0];

    console.log('Input field comparison:');
    console.log(`  ${label1} fields:`, Object.keys(input1));
    console.log(`  ${label2} fields:`, Object.keys(input2));

    // Find differences
    const fields1 = Object.keys(input1);
    const fields2 = Object.keys(input2);
    const onlyIn1 = fields1.filter((f) => !fields2.includes(f));
    const onlyIn2 = fields2.filter((f) => !fields1.includes(f));

    if (onlyIn1.length > 0) {
      console.log(`  Fields only in ${label1}:`, onlyIn1);
    }
    if (onlyIn2.length > 0) {
      console.log(`  Fields only in ${label2}:`, onlyIn2);
    }

    // Compare signature types
    console.log('\nSignature comparison:');
    console.log(`  ${label1}:`, {
      hasTapKeySig: !!input1.tapKeySig,
      hasPartialSig: !!input1.partialSig,
      tapKeySigLength: input1.tapKeySig?.length || 0,
    });
    console.log(`  ${label2}:`, {
      hasTapKeySig: !!input2.tapKeySig,
      hasPartialSig: !!input2.partialSig,
      tapKeySigLength: input2.tapKeySig?.length || 0,
    });

    // Compare sighashType
    console.log('\nSighash comparison:');
    console.log(`  ${label1} sighashType:`, input1.sighashType);
    console.log(`  ${label2} sighashType:`, input2.sighashType);
  } catch (err) {
    console.error('Comparison failed:', err.message);
  }
};

/**
 * Log detailed PSBT structure
 * @param {string} psbtBase64 - PSBT in base64 format
 * @param {string} label - Label for logging
 */
export const logPsbtStructure = (psbtBase64, label) => {
  console.log(`\n═══ ${label} Structure ═══`);

  try {
    const psbt = bitcoin.Psbt.fromBase64(psbtBase64);
    console.log('Version:', psbt.version);
    console.log('Locktime:', psbt.locktime);
    console.log('Inputs:', psbt.inputCount);
    console.log('Outputs:', psbt.data.outputs.length);

    // Log each input
    for (let i = 0; i < psbt.inputCount; i++) {
      const input = psbt.data.inputs[i];
      console.log(`\nInput ${i}:`);
      console.log('  Fields:', Object.keys(input));
      console.log('  Details:', {
        hasTapKeySig: !!input.tapKeySig,
        tapKeySigLength: input.tapKeySig?.length || 0,
        hasPartialSig: !!input.partialSig,
        hasTapInternalKey: !!input.tapInternalKey,
        tapInternalKeyLength: input.tapInternalKey?.length || 0,
        hasWitnessUtxo: !!input.witnessUtxo,
        witnessUtxoValue: input.witnessUtxo?.value,
        sighashType: input.sighashType,
        hasFinalScriptWitness: !!input.finalScriptWitness,
        hasFinalScriptSig: !!input.finalScriptSig,
      });
    }

    // Log each output
    for (let i = 0; i < psbt.data.outputs.length; i++) {
      const output = psbt.data.outputs[i];
      console.log(`\nOutput ${i}:`);
      console.log('  Fields:', Object.keys(output));
    }
  } catch (err) {
    console.error(`Failed to log ${label}:`, err.message);
  }
};
