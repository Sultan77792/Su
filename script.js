let waterReservoirsData = [];

async function initializeForm() {
    const response = await fetch('http://backend:8000/api/reservoirs/all');
    const reservoirs = await response.json();
    const datalist = document.createElement('datalist');
    datalist.id = 'reservoir-names';
    reservoirs.forEach(r => {
        const option = document.createElement('option');
        option.value = r.name;
        datalist.appendChild(option);
    });
    document.body.appendChild(datalist);
}

function addWaterReservoir() {
    const selectedFili = document.getElementById("fili").value;
    if (selectedFili === "all") {
        alert("Пожалуйста, выберите конкретный филиал!");
        return;
    }
    const currentYear = new Date().getFullYear();
    const pastYear = currentYear - 1;

    const newReservoir = {
        id: `${selectedFili}_${Date.now()}`,
        name: "",
        fili: selectedFili,
        npu: "",
        [`npu_${pastYear}`]: "",
        [`npu_${currentYear}`]: "",
        volume: "",
        fpu_volume: "",
        [`volume_${pastYear}`]: "",
        [`volume_${currentYear}`]: "",
        filling: "",
        free_volume: "",
        [`daily_inflow_${pastYear}`]: "",
        [`daily_inflow_${currentYear}`]: "",
        [`daily_outflow_${pastYear}`]: "",
        [`daily_outflow_${currentYear}`]: "",
        max_capacity: "",
        min_volume: "",
        isFirst: false
    };
    waterReservoirsData.push(newReservoir);
    updateTable(selectedFili);
}

function deleteWaterReservoir(reservoirId) {
    const reservoir = waterReservoirsData.find(r => r.id === reservoirId);
    if (reservoir && reservoir.isFirst) return;

    const selectedFili = document.getElementById("fili").value;
    waterReservoirsData = waterReservoirsData.filter(r => r.id !== reservoirId);
    updateTable(selectedFili);
}

function isRowEmpty(reservoir) {
    return (
        !reservoir.name &&
        !reservoir.npu &&
        !reservoir[`npu_${new Date().getFullYear() - 1}`] &&
        !reservoir[`npu_${new Date().getFullYear()}`] &&
        !reservoir.volume &&
        !reservoir.fpu_volume &&
        !reservoir[`volume_${new Date().getFullYear() - 1}`] &&
        !reservoir[`volume_${new Date().getFullYear()}`] &&
        !reservoir.filling &&
        !reservoir.free_volume &&
        !reservoir[`daily_inflow_${new Date().getFullYear() - 1}`] &&
        !reservoir[`daily_inflow_${new Date().getFullYear()}`] &&
        !reservoir[`daily_outflow_${new Date().getFullYear() - 1}`] &&
        !reservoir[`daily_outflow_${new Date().getFullYear()}`] &&
        !reservoir.max_capacity &&
        !reservoir.min_volume
    );
}

function updateTable(filiFilter = "all") {
    const tableBody = document.getElementById("water-reservoirs");
    tableBody.innerHTML = "";
    const currentYear = new Date().getFullYear();
    const pastYear = currentYear - 1;

    const headers = document.querySelectorAll("th");
    headers.forEach(th => {
        if (th.textContent === "2024") th.textContent = pastYear;
        if (th.textContent === "2025") th.textContent = currentYear;
    });

    if (filiFilter !== "all" && !waterReservoirsData.some(r => r.fili === filiFilter && r.isFirst)) {
        waterReservoirsData.push({
            id: `${filiFilter}_first`,
            name: "",
            fili: filiFilter,
            isFirst: true
        });
    }

    const filteredData = filiFilter === "all"
        ? waterReservoirsData.filter(r => r.fili && !isRowEmpty(r))
        : waterReservoirsData.filter(r => r.fili === filiFilter);

    filteredData.forEach((reservoir, index) => {
        const row = tableBody.insertRow();
        row.setAttribute("data-id", reservoir.id);

        const cells = [
            { value: index + 1, type: "text", class: "row-number", readonly: true },
            { name: "name", value: reservoir.name, type: "text", list: "reservoir-names" },
            { name: "npu", value: reservoir.npu, type: "number" },
            { name: `npu_${pastYear}`, value: reservoir[`npu_${pastYear}`], type: "number" },
            { name: `npu_${currentYear}`, value: reservoir[`npu_${currentYear}`], type: "number", class: "current-year-column" },
            { name: "volume", value: reservoir.volume, type: "number" },
            { name: "fpu_volume", value: reservoir.fpu_volume, type: "number" },
            { name: `volume_${pastYear}`, value: reservoir[`volume_${pastYear}`], type: "number" },
            { name: `volume_${currentYear}`, value: reservoir[`volume_${currentYear}`], type: "number", class: "current-year-column" },
            { name: "filling", value: reservoir.filling, type: "number" },
            { name: "free_volume", value: reservoir.free_volume, type: "number", class: "free-volume-column" },
            { name: `daily_inflow_${pastYear}`, value: reservoir[`daily_inflow_${pastYear}`], type: "number" },
            { name: `daily_inflow_${currentYear}`, value: reservoir[`daily_inflow_${currentYear}`], type: "number", class: "current-year-column" },
            { name: `daily_outflow_${pastYear}`, value: reservoir[`daily_outflow_${pastYear}`], type: "number" },
            { name: `daily_outflow_${currentYear}`, value: reservoir[`daily_outflow_${currentYear}`], type: "number", class: "current-year-column" },
            { name: "max_capacity", value: reservoir.max_capacity, type: "number" },
            { name: "min_volume", value: reservoir.min_volume, type: "text" }
        ];

        cells.forEach(cell => {
            const newCell = row.insertCell(-1);
            if (cell.class) newCell.className = cell.class;

            if (cell.readonly) {
                newCell.textContent = cell.value;
            } else {
                const input = document.createElement("input");
                input.type = cell.type;
                input.name = `row_${reservoir.id}_${cell.name}`;
                input.value = cell.value || "";
                input.required = true;
                if (cell.type === "number") input.min = "0";
                if (cell.list) input.setAttribute("list", cell.list);

                input.addEventListener("input", function () {
                    const rowId = row.getAttribute("data-id");
                    const fieldName = cell.name;
                    const reservoir = waterReservoirsData.find(r => r.id === rowId);
                    if (reservoir) reservoir[fieldName] = this.value;
                });
                newCell.appendChild(input);
            }
        });

        const actionCell = row.insertCell(-1);
        if (!reservoir.isFirst) {
            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-btn";
            deleteButton.textContent = "Удалить";
            deleteButton.onclick = () => deleteWaterReservoir(reservoir.id);
            actionCell.appendChild(deleteButton);
        }
    });
}

function exportToExcel() {
    const organization = document.getElementById("organization").value;
    const date = document.getElementById("date").value;
    const executor = document.getElementById("executor").value;
    const dataToSend = {
        organization,
        date,
        executor,
        waterReservoirs: waterReservoirsData.filter(r => !isRowEmpty(r))
    };

    fetch('http://backend:8000/generate-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
    })
    .then(response => response.blob())
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `water_reservoirs_${date.replace(/ /g, '_')}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    })
    .catch(error => alert('Ошибка при экспорте в Excel: ' + error));
}

function validateForm() {
    const inputs = document.querySelectorAll('input');
    for (let input of inputs) {
        if (input.type === "number" && parseFloat(input.value) < 0) {
            alert("Значения в числовых полях не могут быть отрицательными!");
            return false;
        }
        if (!input.value && input.required) {
            alert("Все поля должны быть заполнены!");
            return false;
        }
    }

    const organization = document.getElementById("organization").value;
    const date = document.getElementById("date").value;
    const executor = document.getElementById("executor").value;
    const dataToSend = {
        organization,
        date,
        executor,
        waterReservoirs: waterReservoirsData.filter(r => !isRowEmpty(r))
    };

    fetch('http://backend:8000/submit_data/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSend)
    })
    .then(response => response.json())
    .then(data => alert('Данные успешно отправлены!'))
    .catch(error => alert('Ошибка при отправке данных: ' + error));

    return false; // Предотвращаем стандартную отправку формы
}

document.getElementById("fili").addEventListener("change", function () {
    updateTable(this.value);
});

document.addEventListener("DOMContentLoaded", () => {
    initializeForm();
    updateTable();
});