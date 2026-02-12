{ config, pkgs, lib, modulesPath, ... }:

{
  imports = [
    (modulesPath + "/profiles/qemu-guest.nix")
    ./myclaw.nix
  ];

  # System settings
  system.stateVersion = "24.11";

  # Bootloader (disko handles disk config)
  boot.loader.grub = {
    enable = true;
    efiSupport = true;
    efiInstallAsRemovable = true;
  };

  # Kernel modules for Hetzner Cloud VMs
  boot.initrd.availableKernelModules = [
    "ata_piix" "virtio_pci" "virtio_scsi" "xhci_pci" "sd_mod" "sr_mod"
  ];

  # Platform
  nixpkgs.hostPlatform = lib.mkDefault "x86_64-linux";

  # Networking
  networking = {
    hostName = "myclaw";
    firewall = {
      enable = true;
      allowedTCPPorts = [ 22 ];
    };
  };

  # Timezone
  time.timeZone = "Europe/Paris";

  # Locales
  i18n.defaultLocale = "en_US.UTF-8";
  i18n.extraLocaleSettings = {
    LC_TIME = "fr_FR.UTF-8";
  };

  # SSH
  services.openssh = {
    enable = true;
    settings = {
      PermitRootLogin = "prohibit-password";
      PasswordAuthentication = false;
      KbdInteractiveAuthentication = false;
    };
  };

  # Users
  users.users.root = {
    openssh.authorizedKeys.keys = [
      # SSH public key injected by GitHub Actions during deployment
    ];
  };

  users.users.myclaw = {
    isNormalUser = true;
    description = "MyClaw service user";
    home = "/var/lib/myclaw";
    createHome = true;
    group = "myclaw";
  };

  # Essential packages
  environment.systemPackages = with pkgs; [
    # Core utilities
    git
    curl
    jq
    htop
    vim

    # Node.js for MyClaw
    nodejs_22
    nodePackages.npm

    # Claude Code CLI runtime dependencies
    ripgrep

    # Native module compilation (better-sqlite3, sqlite-vec)
    python3
    gcc
    gnumake

    # Vault sync
    rclone
  ];

  # Automatic updates
  system.autoUpgrade = {
    enable = true;
    allowReboot = false;
    dates = "04:00";
  };

  # Garbage collection
  nix.gc = {
    automatic = true;
    dates = "weekly";
    options = "--delete-older-than 30d";
  };

  # Enable flakes
  nix.settings.experimental-features = [ "nix-command" "flakes" ];

  # Security hardening
  security = {
    sudo.wheelNeedsPassword = true;
    auditd.enable = true;
  };

  # Journald configuration
  services.journald.extraConfig = ''
    SystemMaxUse=500M
    MaxRetentionSec=1month
  '';
}
