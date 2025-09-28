import { getContext, setContext } from 'svelte';
import { todoService } from '$lib/client/todos';
import type { TodoSectionWithTodosByPriority } from '$lib/server/db';

const SECTIONS_KEY = Symbol('sections');

export interface SectionsContext {
    sections: TodoSectionWithTodosByPriority[];
    refreshSections: () => Promise<void>;
    updateSections: (newSections: TodoSectionWithTodosByPriority[]) => void;
}

export function createSectionsContext(): SectionsContext {
    let sections = $state<TodoSectionWithTodosByPriority[]>([]);

    const refreshSections = async () => {
        sections = await todoService.getSectionsWithTodosPriority();
    };

    const updateSections = (newSections: TodoSectionWithTodosByPriority[]) => {
        sections = newSections;
    };

    return {
        get sections() { return sections; },
        refreshSections,
        updateSections
    };
}

export function setSectionsContext(context: SectionsContext) {
    setContext(SECTIONS_KEY, context);
}

export function getSectionsContext(): SectionsContext {
    const context = getContext<SectionsContext>(SECTIONS_KEY);
    if (!context) {
        throw new Error('Sections context not found. Make sure to call setSectionsContext in a parent component.');
    }
    return context;
}