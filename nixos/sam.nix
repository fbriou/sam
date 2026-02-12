{ config, pkgs, lib, ... }:

{
  # Sam systemd service
  systemd.services.sam = {
    description = "Sam AI Assistant";
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];

    path = [ pkgs.nodejs_22 pkgs.git pkgs.ripgrep ];
    environment = {
      HOME = "/var/lib/sam";
      NODE_ENV = "production";
    };

    serviceConfig = {
      Type = "simple";
      User = "sam";
      Group = "sam";
      WorkingDirectory = "/var/lib/sam/app";
      EnvironmentFile = "/var/lib/sam/.env";
      ExecStart = "${pkgs.nodejs_22}/bin/node /var/lib/sam/app/dist/index.js";
      Restart = "always";
      RestartSec = 10;

      # Security hardening
      NoNewPrivileges = true;
      ProtectSystem = "strict";
      ProtectHome = "read-only";
      ReadWritePaths = [ "/var/lib/sam" ];
      PrivateTmp = true;
    };
  };

  # --- rclone timers for vault sync ---

  # Pull vault from Google Drive (every 5 minutes)
  systemd.services.sam-vault-pull = {
    description = "Pull Obsidian vault from Google Drive";
    serviceConfig = {
      Type = "oneshot";
      User = "sam";
      Group = "sam";
      ExecStart = "${pkgs.rclone}/bin/rclone sync gdrive:vault /var/lib/sam/vault --config /var/lib/sam/.config/rclone/rclone.conf --exclude memories/** --log-level NOTICE";
    };
  };

  systemd.timers.sam-vault-pull = {
    description = "Pull vault from Google Drive every 5 minutes";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnBootSec = "1min";
      OnUnitActiveSec = "5min";
      RandomizedDelaySec = "30s";
    };
  };

  # Push memories to Google Drive (every 5 minutes, offset)
  systemd.services.sam-vault-push = {
    description = "Push memories to Google Drive";
    serviceConfig = {
      Type = "oneshot";
      User = "sam";
      Group = "sam";
      ExecStart = "${pkgs.rclone}/bin/rclone sync /var/lib/sam/vault/memories gdrive:vault/memories --config /var/lib/sam/.config/rclone/rclone.conf --log-level NOTICE";
    };
  };

  systemd.timers.sam-vault-push = {
    description = "Push memories to Google Drive every 5 minutes";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnBootSec = "3min";
      OnUnitActiveSec = "5min";
      RandomizedDelaySec = "30s";
    };
  };

  # Daily SQLite backup to Google Drive
  systemd.services.sam-db-backup = {
    description = "Backup Sam SQLite database to Google Drive";
    serviceConfig = {
      Type = "oneshot";
      User = "sam";
      Group = "sam";
      ExecStart = "${pkgs.rclone}/bin/rclone copy /var/lib/sam/data/sam.db gdrive:backups/sam/ --config /var/lib/sam/.config/rclone/rclone.conf --log-level NOTICE";
    };
  };

  systemd.timers.sam-db-backup = {
    description = "Daily SQLite backup at 3:00 AM";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "*-*-* 03:00:00";
      Persistent = true;
    };
  };

  # Working directories
  systemd.tmpfiles.rules = [
    "d /var/lib/sam 0750 sam sam -"
    "d /var/lib/sam/app 0750 sam sam -"
    "d /var/lib/sam/data 0750 sam sam -"
    "d /var/lib/sam/vault 0750 sam sam -"
    "d /var/lib/sam/vault/memories 0750 sam sam -"
    "d /var/lib/sam/.config/rclone 0700 sam sam -"
  ];

  # User and group
  users.groups.sam = {};
}
