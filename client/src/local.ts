import './lib/styles.css'
import { mount } from 'svelte'
import Local from './pages/Local.svelte'

mount(Local, { target: document.getElementById('app')! })
