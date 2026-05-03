import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorSpace } from './editor-space';

describe('EditorSpace', () => {
  let component: EditorSpace;
  let fixture: ComponentFixture<EditorSpace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorSpace],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorSpace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
