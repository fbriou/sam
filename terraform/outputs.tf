output "server_ip" {
  description = "Public IP address of the Sam server"
  value       = hcloud_server.sam.ipv4_address
}

output "server_ipv6" {
  description = "IPv6 address of the Sam server"
  value       = hcloud_server.sam.ipv6_address
}

output "server_id" {
  description = "Hetzner server ID"
  value       = hcloud_server.sam.id
}

output "server_status" {
  description = "Server status"
  value       = hcloud_server.sam.status
}

output "ssh_command" {
  description = "SSH command to connect to the server"
  value       = "ssh root@${hcloud_server.sam.ipv4_address}"
}

output "firewall_id" {
  description = "Hetzner firewall ID"
  value       = hcloud_firewall.sam.id
}
