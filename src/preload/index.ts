import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from '@shared/types'

const call = (channel: string) => (...args: unknown[]) => ipcRenderer.invoke(channel, ...args)

const api: Api = {
  auth: {
    status: call('auth:status'),
    loginUsers: call('auth:loginUsers'),
    login: call('auth:login'),
    loginPin: call('auth:loginPin'),
    logout: call('auth:logout'),
    setLanguage: call('auth:setLanguage')
  },
  visits: {
    lookup: call('visits:lookup'),
    checkIn: call('visits:checkIn'),
    checkOut: call('visits:checkOut'),
    insideNow: call('visits:insideNow'),
    search: call('visits:search'),
    get: call('visits:get'),
    stats: call('visits:stats'),
    suggestions: call('visits:suggestions')
  },
  notes: {
    add: call('notes:add'),
    list: call('notes:list')
  },
  registers: {
    list: call('registers:list'),
    save: call('registers:save'),
    entries: call('registers:entries'),
    add: call('registers:add'),
    close: call('registers:close'),
    correct: call('registers:correct'),
    corrections: call('registers:corrections'),
    accounts: call('registers:accounts'),
    installTemplates: call('registers:installTemplates'),
    delete: call('registers:delete')
  },
  audit: {
    list: call('audit:list')
  },
  system: {
    info: call('system:info'),
    backup: call('system:backup'),
    restoreFile: call('system:restoreFile'),
    restoreCopy: call('system:restoreCopy'),
    erase: call('system:erase'),
    factoryReset: call('system:factoryReset'),
    openFolder: call('system:openFolder'),
    restart: call('system:restart'),
    recover: call('system:recover')
  },
  levels: {
    list: call('levels:list'),
    save: call('levels:save'),
    remove: call('levels:remove')
  },
  users: {
    list: call('users:list'),
    create: call('users:create'),
    update: call('users:update')
  },
  settings: {
    get: call('settings:get'),
    set: call('settings:set'),
    getFeatures: call('settings:getFeatures'),
    setFeatures: call('settings:setFeatures')
  },
  scan: {
    analyze: call('scan:analyze'),
    readText: call('scan:readText'),
    readFront: call('scan:readFront'),
    barcodes: call('scan:barcodes')
  },
  students: {
    list: call('students:list'),
    suggest: call('students:suggest'),
    count: call('students:count'),
    save: call('students:save'),
    setActive: call('students:setActive'),
    remove: call('students:remove'),
    import: call('students:import'),
    template: call('students:template'),
    pdf: call('students:pdf'),
    xlsx: call('students:xlsx')
  },
  exports: {
    pdf: call('exports:pdf'),
    excel: call('exports:excel'),
    registerPdf: call('exports:registerPdf'),
    entryPdf: call('exports:entryPdf'),
    auditPdf: call('exports:auditPdf'),
    visitPdf: call('exports:visitPdf'),
    registerXlsx: call('exports:registerXlsx'),
    entryXlsx: call('exports:entryXlsx'),
    auditXlsx: call('exports:auditXlsx'),
    visitXlsx: call('exports:visitXlsx'),
    insideXlsx: call('exports:insideXlsx'),
    evacuation: call('exports:evacuation'),
    shiftReport: call('exports:shiftReport')
  },
  vehicles: {
    lookup: call('vehicles:lookup'),
    checkIn: call('vehicles:checkIn'),
    checkOut: call('vehicles:checkOut'),
    inside: call('vehicles:inside'),
    search: call('vehicles:search'),
    photo: call('vehicles:photo')
  },
  deliveries: {
    add: call('deliveries:add'),
    pickUp: call('deliveries:pickUp'),
    waiting: call('deliveries:waiting'),
    search: call('deliveries:search'),
    photo: call('deliveries:photo'),
    recipients: call('deliveries:recipients')
  },
  incidents: {
    add: call('incidents:add'),
    close: call('incidents:close'),
    open: call('incidents:open'),
    search: call('incidents:search'),
    get: call('incidents:get')
  },
  shifts: {
    state: call('shifts:state'),
    start: call('shifts:start'),
    end: call('shifts:end'),
    activity: call('shifts:activity'),
    list: call('shifts:list')
  },
  patrols: {
    checkpoints: call('patrols:checkpoints'),
    addCheckpoint: call('patrols:addCheckpoint'),
    updateCheckpoint: call('patrols:updateCheckpoint'),
    labelsPdf: call('patrols:labelsPdf'),
    current: call('patrols:current'),
    start: call('patrols:start'),
    check: call('patrols:check'),
    findByCode: call('patrols:findByCode'),
    finish: call('patrols:finish'),
    list: call('patrols:list'),
    get: call('patrols:get')
  },
  keys: {
    items: call('keys:items'),
    addItem: call('keys:addItem'),
    setActive: call('keys:setActive'),
    lend: call('keys:lend'),
    giveBack: call('keys:giveBack'),
    loans: call('keys:loans')
  },
  alerts: {
    list: call('alerts:list')
  },
  customFields: {
    list: call('customFields:list'),
    add: call('customFields:add'),
    update: call('customFields:update')
  },
  expected: {
    list: call('expected:list'),
    add: call('expected:add'),
    cancel: call('expected:cancel'),
    findByRef: call('expected:findByRef')
  },
  sync: {
    status: call('sync:status'),
    connect: call('sync:connect'),
    disconnect: call('sync:disconnect'),
    now: call('sync:now')
  },
  badges: {
    settings: call('badges:settings'),
    setSettings: call('badges:setSettings'),
    printers: call('badges:printers'),
    print: call('badges:print'),
    preview: call('badges:preview')
  },
  watchlist: {
    check: call('watchlist:check'),
    list: call('watchlist:list'),
    add: call('watchlist:add'),
    setActive: call('watchlist:setActive')
  }
} as Api

contextBridge.exposeInMainWorld('api', api)
