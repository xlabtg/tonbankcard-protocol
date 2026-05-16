/**
 * compose-vm — cloud-init bootstrap for a Tonbankcard VM that runs the
 * off-chain stack via docker compose. The module itself does not create
 * any compute resources; it only renders user-data and surfaces it as an
 * output. Adapters in `infra/terraform/examples/<cloud>` are responsible
 * for the provider-specific VM resource.
 */

terraform {
  required_version = ">= 1.5.0"
}

locals {
  env_file = join("\n", [
    for k, v in var.env : "${k}=${v}"
  ])

  secrets_file = join("\n", [
    for k, v in var.secrets : "${k}=${v}"
  ])

  cloud_init = templatefile("${path.module}/templates/cloud-init.yaml.tftpl", {
    api_image           = var.api_image
    indexer_image       = var.indexer_image
    api_replica_count   = var.api_replica_count
    env_file_b64        = base64encode(local.env_file)
    secrets_file_b64    = base64encode(local.secrets_file)
    ssh_authorized_keys = var.ssh_authorized_keys
    letsencrypt_email   = var.letsencrypt_email
    domain              = var.domain
  })
}

output "user_data" {
  description = "Rendered cloud-init document — feed into the VM resource's user_data field."
  value       = local.cloud_init
  sensitive   = true
}
