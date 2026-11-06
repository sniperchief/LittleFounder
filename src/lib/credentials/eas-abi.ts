// EAS ABI fragments for Base Sepolia, copied verbatim (by script) from the official
// @ethereum-attestation-service/eas-contracts@1.9.0 deployment artifacts
// (deployments/base-sepolia/EAS.json and SchemaRegistry.json). Do not edit by hand.

export const easAbi = [
  {
    "type": "event",
    "name": "Attested",
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "attester",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "uid",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "schemaUID",
        "type": "bytes32"
      }
    ],
    "anonymous": false
  },
  {
    "type": "function",
    "name": "attest",
    "inputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "schema",
            "type": "bytes32"
          },
          {
            "components": [
              {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
              },
              {
                "internalType": "uint64",
                "name": "expirationTime",
                "type": "uint64"
              },
              {
                "internalType": "bool",
                "name": "revocable",
                "type": "bool"
              },
              {
                "internalType": "bytes32",
                "name": "refUID",
                "type": "bytes32"
              },
              {
                "internalType": "bytes",
                "name": "data",
                "type": "bytes"
              },
              {
                "internalType": "uint256",
                "name": "value",
                "type": "uint256"
              }
            ],
            "internalType": "struct AttestationRequestData",
            "name": "data",
            "type": "tuple"
          }
        ],
        "internalType": "struct AttestationRequest",
        "name": "request",
        "type": "tuple"
      }
    ],
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "payable"
  },
  {
    "type": "function",
    "name": "getAttestation",
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "uid",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "uid",
            "type": "bytes32"
          },
          {
            "internalType": "bytes32",
            "name": "schema",
            "type": "bytes32"
          },
          {
            "internalType": "uint64",
            "name": "time",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "expirationTime",
            "type": "uint64"
          },
          {
            "internalType": "uint64",
            "name": "revocationTime",
            "type": "uint64"
          },
          {
            "internalType": "bytes32",
            "name": "refUID",
            "type": "bytes32"
          },
          {
            "internalType": "address",
            "name": "recipient",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "attester",
            "type": "address"
          },
          {
            "internalType": "bool",
            "name": "revocable",
            "type": "bool"
          },
          {
            "internalType": "bytes",
            "name": "data",
            "type": "bytes"
          }
        ],
        "internalType": "struct Attestation",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSchemaRegistry",
    "inputs": [],
    "outputs": [
      {
        "internalType": "contract ISchemaRegistry",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "version",
    "inputs": [],
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  }
] as const;

export const schemaRegistryAbi = [
  {
    "type": "function",
    "name": "getSchema",
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "uid",
        "type": "bytes32"
      }
    ],
    "outputs": [
      {
        "components": [
          {
            "internalType": "bytes32",
            "name": "uid",
            "type": "bytes32"
          },
          {
            "internalType": "contract ISchemaResolver",
            "name": "resolver",
            "type": "address"
          },
          {
            "internalType": "bool",
            "name": "revocable",
            "type": "bool"
          },
          {
            "internalType": "string",
            "name": "schema",
            "type": "string"
          }
        ],
        "internalType": "struct SchemaRecord",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "register",
    "inputs": [
      {
        "internalType": "string",
        "name": "schema",
        "type": "string"
      },
      {
        "internalType": "contract ISchemaResolver",
        "name": "resolver",
        "type": "address"
      },
      {
        "internalType": "bool",
        "name": "revocable",
        "type": "bool"
      }
    ],
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "version",
    "inputs": [],
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view"
  }
] as const;
