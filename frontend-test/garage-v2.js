/**
 * Garage Feature - Frontend JavaScript (Version 2)
 * Auto-save functionality with My Garage displayed at top
 */

class GarageManager {
  constructor() {
    this.apiBaseUrl = 'http://localhost:3000';
    this.customerId = 'gid://shopify/Customer/123456'; // Test customer ID
    this.allVehicles = [];
    this.myGarage = [];
    this.saveTimeout = null;
    this.isSaving = false;

    this.init();
  }

  init() {
    // Get DOM elements
    this.garageIcon = document.getElementById('garageIcon');
    this.garageBadge = document.getElementById('garageBadge');
    this.modalOverlay = document.getElementById('modalOverlay');
    this.closeModal = document.getElementById('closeModal');
    this.searchBox = document.getElementById('searchBox');
    this.vehicleList = document.getElementById('vehicleList');
    this.loadingMessage = document.getElementById('loadingMessage');
    this.myGarageTop = document.getElementById('myGarageTop');
    this.myGarageList = document.getElementById('myGarageList');
    this.emptyGarage = document.getElementById('emptyGarage');
    this.garageCount = document.getElementById('garageCount');
    this.savingIndicator = document.getElementById('savingIndicator');
    this.apiBaseUrlInput = document.getElementById('apiBaseUrl');
    this.customerIdInput = document.getElementById('customerId');
    this.apiStatus = document.getElementById('apiStatus');

    // Event listeners
    this.garageIcon.addEventListener('click', () => this.openModal());
    this.closeModal.addEventListener('click', () => this.closeModalFn());
    this.modalOverlay.addEventListener('click', (e) => {
      if (e.target === this.modalOverlay) {
        this.closeModalFn();
      }
    });
    this.searchBox.addEventListener('input', (e) => this.handleSearch(e.target.value));

    // Update config when changed
    this.apiBaseUrlInput.addEventListener('change', (e) => {
      this.apiBaseUrl = e.target.value;
    });
    this.customerIdInput.addEventListener('change', (e) => {
      this.customerId = e.target.value;
    });

    // Load initial data
    this.loadCustomerGarage();
  }

  showApiStatus(message, isError = false) {
    this.apiStatus.style.display = 'block';
    this.apiStatus.className = `api-status ${isError ? 'error' : 'success'}`;
    this.apiStatus.textContent = message;
  }

  async loadCustomerGarage() {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/apps/customer/vehicles/get?customerId=${encodeURIComponent(this.customerId)}`
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.myGarage = data.vehicles || [];
      this.updateBadge();
      this.showApiStatus(`✓ Loaded ${this.myGarage.length} vehicles from garage`);
    } catch (error) {
      console.error('Error loading customer garage:', error);
      this.showApiStatus(`✗ Error loading garage: ${error.message}`, true);
      this.myGarage = [];
      this.updateBadge();
    }
  }

  async loadAllVehicles() {
    this.loadingMessage.style.display = 'block';
    this.vehicleList.style.display = 'none';

    try {
      const response = await fetch(`${this.apiBaseUrl}/apps/vehicles/list`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.allVehicles = data.vehicles || [];
      this.renderVehicleList();
      this.showApiStatus(`✓ Loaded ${this.allVehicles.length} available vehicles`);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      this.showApiStatus(`✗ Error loading vehicles: ${error.message}`, true);
      this.loadingMessage.innerHTML = `
        <div style="color: #e74c3c;">
          <strong>Error loading vehicles</strong><br>
          ${error.message}<br>
          <small>Make sure the backend is running at ${this.apiBaseUrl}</small>
        </div>
      `;
    }
  }

  renderVehicleList(filter = '') {
    this.loadingMessage.style.display = 'none';
    this.vehicleList.style.display = 'block';

    let vehicles = this.allVehicles;

    // Apply filter
    if (filter) {
      const lowerFilter = filter.toLowerCase();
      vehicles = vehicles.filter(v => {
        const searchStr = `${v.year} ${v.make} ${v.model} ${v.style || ''}`.toLowerCase();
        return searchStr.includes(lowerFilter);
      });
    }

    // Limit to 100 results for performance
    const displayVehicles = vehicles.slice(0, 100);

    this.vehicleList.innerHTML = displayVehicles.map(vehicle => `
      <div class="vehicle-item ${this.isInGarage(vehicle) ? 'selected' : ''}"
           data-vehicle='${JSON.stringify(vehicle).replace(/'/g, "&apos;")}'>
        <input
          type="checkbox"
          class="vehicle-checkbox"
          ${this.isInGarage(vehicle) ? 'checked' : ''}
        />
        <div class="vehicle-info">
          <div class="vehicle-name">
            ${vehicle.year} ${vehicle.make} ${vehicle.model}
          </div>
          ${vehicle.style ? `<div class="vehicle-style">${vehicle.style}</div>` : ''}
        </div>
      </div>
    `).join('');

    // Add click handlers
    this.vehicleList.querySelectorAll('.vehicle-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.type !== 'checkbox') {
          const checkbox = item.querySelector('.vehicle-checkbox');
          checkbox.checked = !checkbox.checked;
        }
        this.toggleVehicle(JSON.parse(item.dataset.vehicle));
      });
    });

    // Show count
    if (filter && displayVehicles.length < vehicles.length) {
      const countDiv = document.createElement('div');
      countDiv.style.textAlign = 'center';
      countDiv.style.padding = '1rem';
      countDiv.style.color = '#666';
      countDiv.textContent = `Showing ${displayVehicles.length} of ${vehicles.length} results`;
      this.vehicleList.appendChild(countDiv);
    }
  }

  isInGarage(vehicle) {
    return this.myGarage.some(v => v.vehicle_id === vehicle.vehicle_id);
  }

  toggleVehicle(vehicle) {
    const index = this.myGarage.findIndex(v => v.vehicle_id === vehicle.vehicle_id);

    if (index >= 0) {
      // Remove from garage
      this.myGarage.splice(index, 1);
    } else {
      // Add to garage
      this.myGarage.push(vehicle);
    }

    this.renderMyGarage();
    this.renderVehicleList(this.searchBox.value);

    // Auto-save with debounce
    this.scheduleAutoSave();
  }

  scheduleAutoSave() {
    // Clear any pending save
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    // Show saving indicator
    this.showSavingIndicator('Saving...');

    // Schedule save after 1 second of inactivity
    this.saveTimeout = setTimeout(() => {
      this.autoSaveGarage();
    }, 1000);
  }

  showSavingIndicator(message) {
    this.savingIndicator.textContent = message;
    this.savingIndicator.style.display = 'block';
  }

  hideSavingIndicator() {
    setTimeout(() => {
      this.savingIndicator.style.display = 'none';
    }, 2000);
  }

  async autoSaveGarage() {
    if (this.isSaving) return;

    this.isSaving = true;

    try {
      const response = await fetch(`${this.apiBaseUrl}/apps/customer/vehicles/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          customerId: this.customerId,
          vehicles: this.myGarage
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      this.showSavingIndicator('✓ Saved');
      this.showApiStatus(`✓ Garage auto-saved (${this.myGarage.length} vehicles)`);
      this.hideSavingIndicator();

    } catch (error) {
      console.error('Error auto-saving garage:', error);
      this.showSavingIndicator('✗ Save failed');
      this.showApiStatus(`✗ Error saving garage: ${error.message}`, true);
      setTimeout(() => {
        this.savingIndicator.style.display = 'none';
      }, 3000);
    } finally {
      this.isSaving = false;
    }
  }

  renderMyGarage() {
    this.garageCount.textContent = this.myGarage.length;

    if (this.myGarage.length === 0) {
      this.myGarageTop.style.display = 'none';
      this.emptyGarage.style.display = 'block';
    } else {
      this.myGarageTop.style.display = 'block';
      this.emptyGarage.style.display = 'none';

      this.myGarageList.innerHTML = this.myGarage.map(vehicle => `
        <div class="my-garage-chip">
          <span class="vehicle-chip-text">
            ${vehicle.year} ${vehicle.make} ${vehicle.model}
          </span>
          <button class="remove-chip-btn" data-vehicle-id="${vehicle.vehicle_id}" title="Remove vehicle">
            ×
          </button>
        </div>
      `).join('');

      // Add remove handlers
      this.myGarageList.querySelectorAll('.remove-chip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const vehicleId = btn.dataset.vehicleId;
          const vehicle = this.myGarage.find(v => v.vehicle_id === vehicleId);
          if (vehicle) {
            this.toggleVehicle(vehicle);
          }
        });
      });
    }

    this.updateBadge();
  }

  updateBadge() {
    const count = this.myGarage.length;
    this.garageBadge.textContent = count;

    if (count > 0) {
      this.garageBadge.classList.add('active');
    } else {
      this.garageBadge.classList.remove('active');
    }
  }

  handleSearch(value) {
    this.renderVehicleList(value);
  }

  async openModal() {
    this.modalOverlay.classList.add('active');

    // Load vehicles if not already loaded
    if (this.allVehicles.length === 0) {
      await this.loadAllVehicles();
    }

    this.renderMyGarage();
  }

  closeModalFn() {
    this.modalOverlay.classList.remove('active');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new GarageManager();
  });
} else {
  new GarageManager();
}
