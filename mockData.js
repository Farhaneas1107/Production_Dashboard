const MOCK_DATA = {
    plants: [
        { id: 'p1', name: 'Espelkamp' },
        { id: 'p2', name: 'Adorf' }
    ],
    machines: [
        { id: 'm1', plantId: 'p1', name: 'Bento 1' },
        { id: 'm2', plantId: 'p1', name: 'K7' },
        { id: 'm3', plantId: 'p2', name: 'Extruder A' },
        { id: 'm4', plantId: 'p2', name: 'Laminator 2' }
    ],
    orders: [
        {
            id: 'ORD-001',
            machineId: 'm1',
            product: 'Geogrid Secugrid 40/40',
            startTime: '2023-10-24T07:15:00', // Shift 1
            endTime: '2023-10-24T13:45:00',   // Completed in Shift 1
            status: 'completed'
        },
        {
            id: 'ORD-002',
            machineId: 'm2',
            product: 'Bentofix Thermal Lock',
            startTime: '2023-10-24T12:00:00', // Starts in Shift 1
            endTime: null,                     // Still ongoing
            status: 'ongoing'
        },
        {
            id: 'ORD-003',
            machineId: 'm3',
            product: 'Secutex Nonwoven',
            startTime: '2023-10-23T23:30:00', // Started in Shift 3 of previous day
            endTime: '2023-10-24T11:00:00',   // Completes in Shift 1 of current day
            status: 'completed'
        }
    ],
    downtimes: [
        {
            id: 'DT-001',
            machineId: 'm1',
            reason: 'Roll Change',
            startTime: '2023-10-24T09:00:00',
            endTime: '2023-10-24T09:30:00'
        },
        {
            id: 'DT-002',
            machineId: 'm2',
            reason: 'Filter Cleaning',
            startTime: '2023-10-24T15:15:00', // Shift 2 
            endTime: '2023-10-24T16:00:00'
        }
    ]
};
