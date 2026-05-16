variable "api_image" {
  type        = string
  description = "Container image reference for the Merchant API (e.g. registry.example.com/tonbankcard/merchant-api:1.0.0)."
}

variable "indexer_image" {
  type        = string
  description = "Container image reference for the Payment Status Indexer."
}

variable "api_replica_count" {
  type        = number
  default     = 2
  description = "Number of API replicas to run on the VM."

  validation {
    condition     = var.api_replica_count >= 2
    error_message = "api_replica_count must be >= 2 to satisfy the availability requirement."
  }
}

variable "env" {
  type        = map(string)
  description = "Map of non-secret environment variables (NODE_ENV, TON_NETWORK, …) rendered into /etc/tonbankcard/.env."
}

variable "secrets" {
  type        = map(string)
  sensitive   = true
  description = "Map of secret environment variables (API_KEY_SECRET, TON_API_KEY, …). Rendered into /etc/tonbankcard/secrets.env with mode 0600."
}

variable "ssh_authorized_keys" {
  type        = list(string)
  description = "SSH public keys granted access to the `tonbankcard` user."
}

variable "letsencrypt_email" {
  type        = string
  default     = ""
  description = "When set, cloud-init also provisions Caddy as a TLS termination proxy in front of the API."
}

variable "domain" {
  type        = string
  default     = ""
  description = "Public hostname for the API. Required when letsencrypt_email is set."
}
