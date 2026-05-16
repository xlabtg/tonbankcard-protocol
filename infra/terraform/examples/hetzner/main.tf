/**
 * Example wiring of the compose-vm module to Hetzner Cloud. Swap the
 * `hcloud_server` resource for any other provider (DigitalOcean, AWS,
 * GCP) — the module output `user_data` is provider-agnostic.
 */

terraform {
  required_version = ">= 1.5.0"
  required_providers {
    hcloud = {
      source  = "hetznercloud/hcloud"
      version = "~> 1.48"
    }
  }
}

provider "hcloud" {
  token = var.hcloud_token
}

module "stack" {
  source = "../../compose-vm"

  api_image     = var.api_image
  indexer_image = var.indexer_image

  env = {
    NODE_ENV                   = "production"
    TON_NETWORK                = "mainnet"
    TON_API_ENDPOINT           = "https://toncenter.com/api/v2"
    PAYMENT_HUB_ADDRESS        = var.payment_hub_address
    MERCHANT_PAYMENT_HUB_ADDRESS = var.merchant_payment_hub_address
    NFT_COLLECTION_7777_ADDRESS = var.nft_collection_7777_address
    NFT_COLLECTION_8888_ADDRESS = var.nft_collection_8888_address
    ALLOWED_ORIGINS            = var.allowed_origins
    LOG_LEVEL                  = "info"
    LOG_PRETTY                 = "false"
  }

  secrets = {
    API_KEY_SECRET = var.api_key_secret
    TON_API_KEY    = var.ton_api_key
  }

  ssh_authorized_keys = var.ssh_authorized_keys
  letsencrypt_email   = var.letsencrypt_email
  domain              = var.domain
}

resource "hcloud_ssh_key" "primary" {
  count      = length(var.ssh_authorized_keys)
  name       = "tonbankcard-${count.index}"
  public_key = var.ssh_authorized_keys[count.index]
}

resource "hcloud_server" "stack" {
  name        = "tonbankcard-${var.environment}"
  image       = "ubuntu-22.04"
  server_type = var.server_type
  location    = var.location
  ssh_keys    = hcloud_ssh_key.primary[*].id
  user_data   = module.stack.user_data

  labels = {
    component = "tonbankcard"
    env       = var.environment
  }
}

output "public_ip" {
  description = "Public IPv4 address of the provisioned VM."
  value       = hcloud_server.stack.ipv4_address
}
