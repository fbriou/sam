{ config, pkgs, lib, ... }:

{
  # MyClaw systemd service
  systemd.services.myclaw = {
    description = "MyClaw AI Assistant";
    after = [ "network-online.target" ];
    wants = [ "network-online.target" ];
    wantedBy = [ "multi-user.target" ];

    path = [ pkgs.nodejs_22 pkgs.git pkgs.ripgrep ];
    environment = {
      HOME = "/var/lib/myclaw";
      NODE_ENV = "production";
    };

    serviceConfig = {
      Type = "simple";
      User = "myclaw";
      Group = "myclaw";
      WorkingDirectory = "/var/lib/myclaw/app";
      EnvironmentFile = "/var/lib/myclaw/.env";
      ExecStart = "${pkgs.nodejs_22}/bin/node /var/lib/myclaw/app/dist/index.js";
      Restart = "always";
      RestartSec = 10;

      # Security hardening
      NoNewPrivileges = true;
      ProtectSystem = "strict";
      ProtectHome = "read-only";
      ReadWritePaths = [ "/var/lib/myclaw" ];
      PrivateTmp = true;
    };
  };

  # --- rclone timers for vault sync ---

  # Pull vault from Google Drive (every 5 minutes)
  systemd.services.myclaw-vault-pull = {
    description = "Pull Obsidian vault from Google Drive";
    serviceConfig = {
      Type = "oneshot";
      User = "myclaw";
      Group = "myclaw";
      ExecStart = "${pkgs.rclone}/bin/rclone sync gdrive:vault /var/lib/myclaw/vault --config /var/lib/myclaw/.config/rclone/rclone.conf --exclude memories/** --log-level NOTICE";
    };
  };

  systemd.timers.myclaw-vault-pull = {
    description = "Pull vault from Google Drive every 5 minutes";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnBootSec = "1min";
      OnUnitActiveSec = "5min";
      RandomizedDelaySec = "30s";
    };
  };

  # Push memories to Google Drive (every 5 minutes, offset)
  systemd.services.myclaw-vault-push = {
    description = "Push memories to Google Drive";
    serviceConfig = {
      Type = "oneshot";
      User = "myclaw";
      Group = "myclaw";
      ExecStart = "${pkgs.rclone}/bin/rclone sync /var/lib/myclaw/vault/memories gdrive:vault/memories --config /var/lib/myclaw/.config/rclone/rclone.conf --log-level NOTICE";
    };
  };

  systemd.timers.myclaw-vault-push = {
    description = "Push memories to Google Drive every 5 minutes";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnBootSec = "3min";
      OnUnitActiveSec = "5min";
      RandomizedDelaySec = "30s";
    };
  };

  # Daily SQLite backup to Google Drive
  systemd.services.myclaw-db-backup = {
    description = "Backup MyClaw SQLite database to Google Drive";
    serviceConfig = {
      Type = "oneshot";
      User = "myclaw";
      Group = "myclaw";
      ExecStart = "${pkgs.rclone}/bin/rclone copy /var/lib/myclaw/data/myclaw.db gdrive:backups/myclaw/ --config /var/lib/myclaw/.config/rclone/rclone.conf --log-level NOTICE";
    };
  };

  systemd.timers.myclaw-db-backup = {
    description = "Daily SQLite backup at 3:00 AM";
    wantedBy = [ "timers.target" ];
    timerConfig = {
      OnCalendar = "*-*-* 03:00:00";
      Persistent = true;
    };
  };

  # Working directories
  systemd.tmpfiles.rules = [
    "d /var/lib/myclaw 0750 myclaw myclaw -"
    "d /var/lib/myclaw/app 0750 myclaw myclaw -"
    "d /var/lib/myclaw/data 0750 myclaw myclaw -"
    "d /var/lib/myclaw/vault 0750 myclaw myclaw -"
    "d /var/lib/myclaw/vault/memories 0750 myclaw myclaw -"
    "d /var/lib/myclaw/.config/rclone 0700 myclaw myclaw -"
  ];

  # User and group
  users.groups.myclaw = {};
}
