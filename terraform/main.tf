# SSH Key
resource "hcloud_ssh_key" "sam" {
  name       = var.server_name
  public_key = var.ssh_public_key
}

# Firewall - Only allow SSH from specific IP
resource "hcloud_firewall" "sam" {
  name = var.server_name

  # Allow SSH only from your IP
  rule {
    description = "Allow SSH from trusted IP"
    direction   = "in"
    protocol    = "tcp"
    port        = "22"
    source_ips  = [var.allowed_ssh_ip]
  }

  # Allow ICMP (ping) from anywhere - useful for debugging
  rule {
    description = "Allow ICMP"
    direction   = "in"
    protocol    = "icmp"
    source_ips  = ["0.0.0.0/0", "::/0"]
  }

  # Allow all outbound traffic
  rule {
    description     = "Allow all outbound TCP"
    direction       = "out"
    protocol        = "tcp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }

  rule {
    description     = "Allow all outbound UDP"
    direction       = "out"
    protocol        = "udp"
    port            = "any"
    destination_ips = ["0.0.0.0/0", "::/0"]
  }
}

# Main server
resource "hcloud_server" "sam" {
  name        = var.server_name
  image       = var.image
  server_type = var.server_type
  location    = var.location

  ssh_keys = [hcloud_ssh_key.sam.id]

  firewall_ids = [hcloud_firewall.sam.id]

  labels = {
    environment = "production"
    service     = "sam"
    managed_by  = "opentofu"
  }

  lifecycle {
    ignore_changes = [
      user_data, # Don't recreate server if cloud-init changes
    ]
  }
}
