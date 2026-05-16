variable "hcloud_token" {
  type        = string
  sensitive   = true
  description = "Hetzner Cloud API token (https://console.hetzner.cloud)."
}

variable "environment" {
  type        = string
  default     = "prod"
  description = "Environment tag applied to the VM."
}

variable "server_type" {
  type        = string
  default     = "cpx21"
  description = "Hetzner instance type. cpx21 has 3 vCPU / 4 GB RAM and is a sensible starting point."
}

variable "location" {
  type        = string
  default     = "fsn1"
  description = "Hetzner location code."
}

variable "ssh_authorized_keys" {
  type        = list(string)
  description = "SSH public keys to install on the VM."
}

variable "api_image" {
  type        = string
  description = "Merchant API image reference, e.g. ghcr.io/xlabtg/tonbankcard/merchant-api:1.0.0."
}

variable "indexer_image" {
  type        = string
  description = "Indexer image reference."
}

variable "api_key_secret" {
  type        = string
  sensitive   = true
  description = "32-byte random hex used to sign issued API keys."
}

variable "ton_api_key" {
  type        = string
  sensitive   = true
  description = "TonCenter API key."
}

variable "payment_hub_address" {
  type        = string
  description = "Bech32 address of the deployed PaymentHub contract."
}

variable "merchant_payment_hub_address" {
  type        = string
  description = "Bech32 address of the deployed MerchantPaymentHub contract."
}

variable "nft_collection_7777_address" {
  type        = string
  description = "Address of the consumer NFT collection."
}

variable "nft_collection_8888_address" {
  type        = string
  description = "Address of the merchant NFT collection."
}

variable "allowed_origins" {
  type        = string
  description = "CORS allow-list (comma-separated)."
}

variable "letsencrypt_email" {
  type        = string
  default     = ""
  description = "Email used by Let's Encrypt account registration."
}

variable "domain" {
  type        = string
  default     = ""
  description = "Public hostname for the API; required when letsencrypt_email is set."
}
