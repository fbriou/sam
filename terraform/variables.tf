variable "hcloud_token" {
  description = "Hetzner Cloud API Token"
  type        = string
  sensitive   = true
}

variable "server_name" {
  description = "Name of the server"
  type        = string
  default     = "myclaw"
}

variable "server_type" {
  description = "Hetzner server type (cx22 = 2 vCPU, 4GB RAM, ~4 EUR/mo)"
  type        = string
  default     = "cx22"
}

variable "location" {
  description = "Hetzner datacenter location"
  type        = string
  default     = "nbg1" # Nuremberg, Germany
}

variable "image" {
  description = "OS image to use (NixOS installed on top via nixos-anywhere)"
  type        = string
  default     = "ubuntu-24.04"
}

variable "ssh_public_key" {
  description = "SSH public key for server access"
  type        = string
}

variable "allowed_ssh_ip" {
  description = "IP address allowed to SSH (CIDR notation, e.g., 1.2.3.4/32)"
  type        = string
}
