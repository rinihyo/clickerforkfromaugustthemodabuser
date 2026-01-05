import './lib/styles.css'
import { mount } from 'svelte'
import Main from './pages/Main.svelte'

mount(Main, { target: document.getElementById('app')! })
